import { createHash } from 'crypto'
import { gzipSync } from 'zlib'
import { computeBodyHash } from './bodyHash'

const deterministicReplacer = (_: any, v: any) => {
  try {
    return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
      Object.fromEntries(Object.entries(v).sort(([ka], [kb]) =>
        ka < kb ? -1 : ka > kb ? 1 : 0))
  }
  catch (error) {
    return v
  }
}

describe('computeBodyHash', () => {
  describe('non-Buffer data', () => {
    it('produces the same hash as JSON.stringify with the deterministic replacer', () => {
      const data = { b: 2, a: 1 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('produces the same hash regardless of key order (deterministic replacer)', () => {
      expect(computeBodyHash({ a: 1, b: 2 })).toBe(computeBodyHash({ b: 2, a: 1 }))
    })

    it('recovers via onSerializeError instead of throwing when reading a property fails', () => {
      // Simulates a property access that fails once (e.g. a lazily-computed value
      // backed by an external resource) - not a plain data-shape issue, exactly
      // the kind of unexpected failure the try/catch around the replacer guards against.
      const onSerializeError = jest.fn()
      let getterCalls = 0
      const flaky: Record<string, any> = {}
      Object.defineProperty(flaky, 'x', {
        enumerable: true,
        get() {
          getterCalls += 1
          if (getterCalls === 1) {
            throw new Error('boom')
          }
          return 42
        },
      })

      expect(() => computeBodyHash(flaky, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('recovers without throwing when no onSerializeError callback is provided', () => {
      let getterCalls = 0
      const flaky: Record<string, any> = {}
      Object.defineProperty(flaky, 'x', {
        enumerable: true,
        get() {
          getterCalls += 1
          if (getterCalls === 1) {
            throw new Error('boom')
          }
          return 42
        },
      })

      expect(() => computeBodyHash(flaky)).not.toThrow()
    })

    it('does not throw when a property getter fails on every access, not just the first', () => {
      // JSON.stringify's own traversal re-reads a nested value's own properties to
      // serialize it, *after* the replacer already recovered from the first failure -
      // that second read happens outside the replacer's own try/catch, so it must be
      // guarded independently.
      const onSerializeError = jest.fn()
      const alwaysFlaky: Record<string, any> = {}
      Object.defineProperty(alwaysFlaky, 'x', {
        enumerable: true,
        get() {
          throw new Error('always boom')
        },
      })

      expect(() => computeBodyHash({ nested: alwaysFlaky }, onSerializeError)).not.toThrow()
      // Even though both the replacer's catch and the outer JSON.stringify catch observe
      // this failure, onSerializeError should only be reported once per call.
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined', () => {
      const onSerializeError = jest.fn()

      expect(() => computeBodyHash(undefined, onSerializeError)).not.toThrow()
      // An omitted body is a normal case, not a serialization failure - it must not be
      // reported as one.
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not throw when data is undefined and no callback is provided', () => {
      expect(() => computeBodyHash(undefined)).not.toThrow()
    })

    it('produces the same, stable hash every time data is undefined', () => {
      // Unlike genuine serialization failures (randomBytes fallback), an omitted body must
      // hash deterministically, or callers of getWithBody(url) without a body would get a
      // different bodyHash - and therefore cache-key - on every request.
      expect(computeBodyHash(undefined)).toBe(computeBodyHash(undefined))
    })

    it('does not collide for structurally different data that both fail to serialize (e.g. circular references)', () => {
      // A fallback like String(data) collapses any plain object to a constant
      // "[object Object]", so two unrelated bodies that both hit the fallback path
      // would otherwise get the same bodyHash - a cache-key collision, not just a miss.
      const circularA: Record<string, any> = { name: 'bodyA' }
      circularA.self = circularA

      const circularB: Record<string, any> = { name: 'bodyB', other: 'completely different content' }
      circularB.self = circularB

      expect(() => computeBodyHash(circularA)).not.toThrow()
      expect(() => computeBodyHash(circularB)).not.toThrow()
      expect(computeBodyHash(circularA)).not.toBe(computeBodyHash(circularB))
    })
  })

  describe('Buffer data', () => {
    it('produces the same hash for two buffers with identical bytes', () => {
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 5])

      expect(computeBodyHash(bufferA)).toBe(computeBodyHash(bufferB))
    })

    it('produces different hashes for buffers with different bytes', () => {
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 6])

      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
    })

    it('hashes the raw buffer bytes directly, not the JSON.stringify representation', () => {
      const buffer = Buffer.from([1, 2, 3, 4, 5])
      const legacyHash = createHash('md5').update(JSON.stringify(buffer, deterministicReplacer)).digest('hex')
      const directHash = createHash('md5').update(buffer).digest('hex')

      expect(computeBodyHash(buffer)).not.toBe(legacyHash)
      expect(computeBodyHash(buffer)).toBe(directHash)
    })
  })

  describe('other ArrayBuffer views (e.g. Uint8Array)', () => {
    it('hashes a Uint8Array the same way as the equivalent Buffer', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5])

      expect(computeBodyHash(bytes)).toBe(computeBodyHash(Buffer.from(bytes)))
    })

    it('produces different hashes for Uint8Arrays with different bytes', () => {
      const bytesA = new Uint8Array([1, 2, 3, 4, 5])
      const bytesB = new Uint8Array([1, 2, 3, 4, 6])

      expect(computeBodyHash(bytesA)).not.toBe(computeBodyHash(bytesB))
    })
  })

  describe('gzip-compressed body across separate requests (render-ssr scenario)', () => {
    it('produces the same hash when the same JSON payload is gzip-compressed independently twice', () => {
      const payload = JSON.stringify({ page: 'home', props: { locale: 'en-US', items: [1, 2, 3] } })

      // Two independent compressions of the same content, as if produced by two
      // separate requests, rather than reusing the same Buffer instance.
      const bufferFromRequestA = gzipSync(Buffer.from(payload))
      const bufferFromRequestB = gzipSync(Buffer.from(payload))

      expect(bufferFromRequestA.equals(bufferFromRequestB)).toBe(true)
      expect(computeBodyHash(bufferFromRequestA)).toBe(computeBodyHash(bufferFromRequestB))
    })

    it('produces a different hash when the underlying JSON payload differs', () => {
      const bufferA = gzipSync(Buffer.from(JSON.stringify({ page: 'home' })))
      const bufferB = gzipSync(Buffer.from(JSON.stringify({ page: 'checkout' })))

      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
    })
  })
})

import { createHash } from 'crypto'
import { gzipSync } from 'zlib'
import { computeBodyHash } from './bodyHash'

const deterministicReplacer = (_: any, v: any) => {
  try {
    return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
      Object.fromEntries(Object.entries(v).sort(([ka], [kb]) =>
        ka < kb ? -1 : ka > kb ? 1 : 0))
  }
  catch (error) {
    return v
  }
}

describe('computeBodyHash', () => {
  describe('non-Buffer data', () => {
    it('produces the same hash as JSON.stringify with the deterministic replacer', () => {
      // Arrange
      const data = { b: 2, a: 1 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('produces the same hash regardless of key order (deterministic replacer)', () => {
      // Arrange & Act
      const hash1 = computeBodyHash({ a: 1, b: 2 })
      const hash2 = computeBodyHash({ b: 2, a: 1 })

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('recovers via onSerializeError instead of throwing when reading a property fails', () => {
      // Arrange
      const onSerializeError = jest.fn()
      let getterCalls = 0
      const flaky: Record<string, any> = {}
      Object.defineProperty(flaky, 'x', {
        enumerable: true,
        get() {
          getterCalls += 1
          if (getterCalls === 1) {
            throw new Error('boom')
          }
          return 42
        },
      })

      // Act & Assert
      expect(() => computeBodyHash(flaky, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('recovers without throwing when no onSerializeError callback is provided', () => {
      // Arrange
      let getterCalls = 0
      const flaky: Record<string, any> = {}
      Object.defineProperty(flaky, 'x', {
        enumerable: true,
        get() {
          getterCalls += 1
          if (getterCalls === 1) {
            throw new Error('boom')
          }
          return 42
        },
      })

      // Act & Assert
      expect(() => computeBodyHash(flaky)).not.toThrow()
    })

    it('hashes empty objects consistently', () => {
      // Arrange
      const data1 = {}
      const data2 = {}

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('hashes null values', () => {
      // Arrange
      const data = null

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32) // MD5 hex digest length
    })

    it('hashes undefined values', () => {
      // Arrange
      const data = undefined

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('hashes string primitives', () => {
      // Arrange
      const data = 'hello'

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('hashes numeric primitives', () => {
      // Arrange
      const data = 42

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('hashes boolean primitives', () => {
      // Arrange
      const data = true

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('hashes arrays', () => {
      // Arrange
      const data = [1, 2, 3]

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('hashes empty arrays', () => {
      // Arrange
      const data: any[] = []

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('produces different hashes for arrays with different values', () => {
      // Arrange
      const data1 = [1, 2, 3]
      const data2 = [1, 2, 4]

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).not.toBe(hash2)
    })

    it('hashes nested objects with sorted keys at all levels', () => {
      // Arrange
      const data1 = { z: { y: 1, x: 2 }, a: 3 }
      const data2 = { a: 3, z: { x: 2, y: 1 } }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('hashes objects with null values', () => {
      // Arrange
      const data = { key: null }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('hashes objects with mixed value types', () => {
      // Arrange
      const data = {
        str: 'hello',
        num: 42,
        bool: true,
        nil: null,
        arr: [1, 2],
        obj: { nested: 'value' },
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('produces deterministic hashes for complex nested structures', () => {
      // Arrange
      const data = {
        users: [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 },
        ],
        metadata: { version: '1.0', z_field: true, a_field: false },
      }

      // Act
      const hash1 = computeBodyHash(data)
      const hash2 = computeBodyHash(JSON.parse(JSON.stringify(data)))

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('calls onSerializeError exactly once when serialization fails', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const flaky: Record<string, any> = {}
      Object.defineProperty(flaky, 'failing', {
        enumerable: true,
        get() {
          throw new Error('fail')
        },
      })

      // Act
      computeBodyHash(flaky, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not call onSerializeError when serialization succeeds', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { key: 'value' }

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('handles objects with symbol properties by ignoring them', () => {
      // Arrange
      const data = { a: 1, b: 2 }
      const sym = Symbol('test')
      ;(data as any)[sym] = 'ignored'

      // Act
      const hash1 = computeBodyHash(data)
      const hash2 = computeBodyHash({ a: 1, b: 2 })

      // Assert
      expect(hash1).toBe(hash2)
    })
  })

  describe('Buffer data', () => {
    it('produces the same hash for two buffers with identical bytes', () => {
      // Arrange
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 5])

      // Act
      const hashA = computeBodyHash(bufferA)
      const hashB = computeBodyHash(bufferB)

      // Assert
      expect(hashA).toBe(hashB)
    })

    it('produces different hashes for buffers with different bytes', () => {
      // Arrange
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 6])

      // Act
      const hashA = computeBodyHash(bufferA)
      const hashB = computeBodyHash(bufferB)

      // Assert
      expect(hashA).not.toBe(hashB)
    })

    it('hashes the raw buffer bytes directly, not the JSON.stringify representation', () => {
      // Arrange
      const buffer = Buffer.from([1, 2, 3, 4, 5])
      const legacyHash = createHash('md5').update(JSON.stringify(buffer, deterministicReplacer)).digest('hex')
      const directHash = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).not.toBe(legacyHash)
      expect(result).toBe(directHash)
    })

    it('hashes empty buffer', () => {
      // Arrange
      const buffer = Buffer.from([])

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('hashes large buffers', () => {
      // Arrange
      const largeBuffer = Buffer.alloc(1024 * 1024) // 1MB

      // Act
      const result = computeBodyHash(largeBuffer)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('produces consistent hash for large buffer when called multiple times', () => {
      // Arrange
      const largeBuffer = Buffer.alloc(100000)
      largeBuffer.fill(42)

      // Act
      const hash1 = computeBodyHash(largeBuffer)
      const hash2 = computeBodyHash(largeBuffer)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('ignores onSerializeError callback for Buffer data', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const buffer = Buffer.from([1, 2, 3])

      // Act
      computeBodyHash(buffer, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })
  })

  describe('gzip-compressed body across separate requests (render-ssr scenario)', () => {
    it('produces the same hash when the same JSON payload is gzip-compressed independently twice', () => {
      // Arrange
      const payload = JSON.stringify({ page: 'home', props: { locale: 'en-US', items: [1, 2, 3] } })
      const bufferFromRequestA = gzipSync(Buffer.from(payload))
      const bufferFromRequestB = gzipSync(Buffer.from(payload))

      // Act
      const hashA = computeBodyHash(bufferFromRequestA)
      const hashB = computeBodyHash(bufferFromRequestB)

      // Assert
      expect(bufferFromRequestA.equals(bufferFromRequestB)).toBe(true)
      expect(hashA).toBe(hashB)
    })

    it('produces a different hash when the underlying JSON payload differs', () => {
      // Arrange
      const bufferA = gzipSync(Buffer.from(JSON.stringify({ page: 'home' })))
      const bufferB = gzipSync(Buffer.from(JSON.stringify({ page: 'checkout' })))

      // Act
      const hashA = computeBodyHash(bufferA)
      const hashB = computeBodyHash(bufferB)

      // Assert
      expect(hashA).not.toBe(hashB)
    })
  })

  describe('type detection and edge cases', () => {
    it('correctly identifies Buffer vs plain object', () => {
      // Arrange
      const buffer = Buffer.from('test')
      const bufferLike = { type: 'Buffer', data: [116, 101, 115, 116] }

      // Act
      const hashBuffer = computeBodyHash(buffer)
      const hashBufferLike = computeBodyHash(bufferLike)

      // Assert
      expect(hashBuffer).not.toBe(hashBufferLike)
    })

    it('handles Date objects', () => {
      // Arrange
      const data = { timestamp: new Date('2023-01-01T00:00:00Z') }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('handles RegExp objects', () => {
      // Arrange
      const data = { pattern: /test/gi }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('handles Error objects', () => {
      // Arrange
      const data = { error: new Error('test error') }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result.length).toBe(32)
    })

    it('returns valid hex string', () => {
      // Arrange
      const data = { test: 'value' }
      const hexRegex = /^[a-f0-9]{32}$/

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(hexRegex.test(result)).toBe(true)
    })
  })

  describe('key ordering and determinism', () => {
    it('sorts keys alphabetically at root level', () => {
      // Arrange
      const data1 = { z: 1, a: 2, m: 3 }
      const data2 = { a: 2, m: 3, z: 1 }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('sorts keys alphabetically at nested levels', () => {
      // Arrange
      const data1 = { outer: { z: 1, a: 2 } }
      const data2 = { outer: { a: 2, z: 1 } }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('handles objects with numeric string keys', () => {
      // Arrange
      const data1 = { '2': 'two', '1': 'one' }
      const data2 = { '1': 'one', '2': 'two' }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('handles objects with special character keys', () => {
      // Arrange
      const data1 = { '_key': 1, '-key': 2, '.key': 3 }
      const data2 = { '.key': 3, '-key': 2, '_key': 1 }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })
  })
})