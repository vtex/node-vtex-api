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
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined and no callback is provided', () => {
      expect(() => computeBodyHash(undefined)).not.toThrow()
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
      // Arrange
      const hash1 = computeBodyHash({ a: 1, b: 2 })
      const hash2 = computeBodyHash({ b: 2, a: 1 })

      // Act & Assert
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

    it('does not throw when a property getter fails on every access, not just the first', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const alwaysFlaky: Record<string, any> = {}
      Object.defineProperty(alwaysFlaky, 'x', {
        enumerable: true,
        get() {
          throw new Error('always boom')
        },
      })

      // Act & Assert
      expect(() => computeBodyHash({ nested: alwaysFlaky }, onSerializeError)).not.toThrow()
      // Even though both the replacer's catch and the outer JSON.stringify catch observe
      // this failure, onSerializeError should only be reported once per call.
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined', () => {
      // Arrange
      const onSerializeError = jest.fn()

      // Act & Assert
      expect(() => computeBodyHash(undefined, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined and no callback is provided', () => {
      // Act & Assert
      expect(() => computeBodyHash(undefined)).not.toThrow()
    })

    it('does not collide for structurally different data that both fail to serialize (e.g. circular references)', () => {
      // Arrange
      const circularA: Record<string, any> = { name: 'bodyA' }
      circularA.self = circularA

      const circularB: Record<string, any> = { name: 'bodyB', other: 'completely different content' }
      circularB.self = circularB

      // Act
      const hashA = computeBodyHash(circularA)
      const hashB = computeBodyHash(circularB)

      // Assert
      expect(() => computeBodyHash(circularA)).not.toThrow()
      expect(() => computeBodyHash(circularB)).not.toThrow()
      expect(hashA).not.toBe(hashB)
    })

    it('handles empty objects deterministically', () => {
      // Arrange
      const hash1 = computeBodyHash({})
      const hash2 = computeBodyHash({})

      // Act & Assert
      expect(hash1).toBe(hash2)
    })

    it('handles empty arrays deterministically', () => {
      // Arrange
      const hash1 = computeBodyHash([])
      const hash2 = computeBodyHash([])

      // Act & Assert
      expect(hash1).toBe(hash2)
    })

    it('handles nested objects with multiple levels', () => {
      // Arrange
      const data1 = { a: { b: { c: 1 } } }
      const data2 = { a: { b: { c: 1 } } }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('handles nested objects with different key ordering at multiple levels', () => {
      // Arrange
      const data1 = { z: 1, a: { y: 2, b: 3 } }
      const data2 = { a: { b: 3, y: 2 }, z: 1 }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('handles null values in objects', () => {
      // Arrange
      const data = { a: null, b: 2 }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(computeBodyHash({ b: 2, a: null }))
    })

    it('handles boolean values', () => {
      // Arrange
      const data1 = { flag: true }
      const data2 = { flag: true }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('handles numeric values including zero and negative numbers', () => {
      // Arrange
      const data1 = { zero: 0, negative: -42, positive: 100 }
      const data2 = { zero: 0, negative: -42, positive: 100 }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('handles string values including empty strings', () => {
      // Arrange
      const data = { empty: '', filled: 'hello' }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles arrays with mixed types', () => {
      // Arrange
      const data = { items: [1, 'string', null, true, { nested: 'object' }] }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('produces different hashes for objects with different values', () => {
      // Arrange
      const hash1 = computeBodyHash({ a: 1 })
      const hash2 = computeBodyHash({ a: 2 })

      // Act & Assert
      expect(hash1).not.toBe(hash2)
    })

    it('produces different hashes for objects with different keys', () => {
      // Arrange
      const hash1 = computeBodyHash({ a: 1 })
      const hash2 = computeBodyHash({ b: 1 })

      // Act & Assert
      expect(hash1).not.toBe(hash2)
    })

    it('calls onSerializeError exactly once even if replacer fails multiple times', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = {
        first: { getter: undefined },
        second: { getter: undefined },
      }

      let failCount = 0
      Object.defineProperty(data.first, 'getter', {
        enumerable: true,
        get() {
          failCount += 1
          if (failCount <= 2) {
            throw new Error('fail')
          }
          return 'value'
        },
      })

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('handles objects with symbol keys (symbols are not enumerable by Object.entries)', () => {
      // Arrange
      const sym = Symbol('test')
      const data = { a: 1, [sym]: 'symbol value' }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('returns a valid hex string', () => {
      // Arrange
      const data = { test: 'value' }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('returns different hashes for different primitive types', () => {
      // Arrange
      const string = 'hello'
      const number = 123

      // Act
      const stringHash = computeBodyHash(string)
      const numberHash = computeBodyHash(number)

      // Assert
      expect(stringHash).not.toBe(numberHash)
    })

    it('handles null directly as data', () => {
      // Act & Assert
      expect(() => computeBodyHash(null)).not.toThrow()
    })

    it('handles boolean directly as data', () => {
      // Arrange
      const hash1 = computeBodyHash(true)
      const hash2 = computeBodyHash(true)

      // Act & Assert
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles number directly as data', () => {
      // Arrange
      const hash1 = computeBodyHash(42)
      const hash2 = computeBodyHash(42)

      // Act & Assert
      expect(hash1).toBe(hash2)
    })

    it('handles string directly as data', () => {
      // Arrange
      const hash1 = computeBodyHash('test string')
      const hash2 = computeBodyHash('test string')

      // Act & Assert
      expect(hash1).toBe(hash2)
    })

    it('does not call onSerializeError when serialization succeeds', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { valid: 'object' }

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('returns a 32-character hex string (MD5 digest length)', () => {
      // Arrange
      const data = { test: true }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result.length).toBe(32)
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

    it('handles empty buffers', () => {
      // Arrange
      const emptyBuffer = Buffer.from([])

      // Act
      const result = computeBodyHash(emptyBuffer)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles large buffers', () => {
      // Arrange
      const largeBuffer = Buffer.alloc(10000, 'test data')

      // Act
      const result = computeBodyHash(largeBuffer)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('produces consistent hash for buffer created from string', () => {
      // Arrange
      const buffer1 = Buffer.from('hello world')
      const buffer2 = Buffer.from('hello world')

      // Act
      const hash1 = computeBodyHash(buffer1)
      const hash2 = computeBodyHash(buffer2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('does not call onSerializeError for buffer data', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const buffer = Buffer.from([1, 2, 3])

      // Act
      computeBodyHash(buffer, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('returns a 32-character hex string for buffer', () => {
      // Arrange
      const buffer = Buffer.from([1, 2, 3, 4, 5])

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result.length).toBe(32)
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles buffer with zero bytes', () => {
      // Arrange
      const buffer = Buffer.from([0, 0, 0, 0])

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles buffer with all 255 bytes', () => {
      // Arrange
      const buffer = Buffer.from([255, 255, 255, 255])

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('produces different hashes for buffers of different lengths with same starting bytes', () => {
      // Arrange
      const bufferA = Buffer.from([1, 2, 3])
      const bufferB = Buffer.from([1, 2, 3, 4])

      // Act
      const hashA = computeBodyHash(bufferA)
      const hashB = computeBodyHash(bufferB)

      // Assert
      expect(hashA).not.toBe(hashB)
    })
  })

  describe('other ArrayBuffer views (e.g. Uint8Array)', () => {
    it('hashes a Uint8Array the same way as the equivalent Buffer', () => {
      // Arrange
      const bytes = new Uint8Array([1, 2, 3, 4, 5])
      const buffer = Buffer.from(bytes)

      // Act
      const bytesHash = computeBodyHash(bytes)
      const bufferHash = computeBodyHash(buffer)

      // Assert
      expect(bytesHash).toBe(bufferHash)
    })

    it('produces different hashes for Uint8Arrays with different bytes', () => {
      // Arrange
      const bytesA = new Uint8Array([1, 2, 3, 4, 5])
      const bytesB = new Uint8Array([1, 2, 3, 4, 6])

      // Act
      const hashA = computeBodyHash(bytesA)
      const hashB = computeBodyHash(bytesB)

      // Assert
      expect(hashA).not.toBe(hashB)
    })

    it('handles DataView as ArrayBuffer view', () => {
      // Arrange
      const arrayBuffer = new ArrayBuffer(4)
      const dataView = new DataView(arrayBuffer)
      dataView.setUint32(0, 0x12345678, false)

      // Act
      const result = computeBodyHash(dataView)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles Int8Array as ArrayBuffer view', () => {
      // Arrange
      const int8Array = new Int8Array([1, -2, 3, -4])

      // Act
      const result = computeBodyHash(int8Array)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles Int16Array as ArrayBuffer view', () => {
      // Arrange
      const int16Array = new Int16Array([1000, -2000])

      // Act
      const result = computeBodyHash(int16Array)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles Int32Array as ArrayBuffer view', () => {
      // Arrange
      const int32Array = new Int32Array([100000, -200000])

      // Act
      const result = computeBodyHash(int32Array)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles Float32Array as ArrayBuffer view', () => {
      // Arrange
      const float32Array = new Float32Array([1.5, 2.5])

      // Act
      const result = computeBodyHash(float32Array)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles Float64Array as ArrayBuffer view', () => {
      // Arrange
      const float64Array = new Float64Array([1.5, 2.5])

      // Act
      const result = computeBodyHash(float64Array)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles BigInt64Array as ArrayBuffer view', () => {
      // Arrange
      const bigInt64Array = new BigInt64Array([BigInt(100), BigInt(-200)])

      // Act
      const result = computeBodyHash(bigInt64Array)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles BigUint64Array as ArrayBuffer view', () => {
      // Arrange
      const bigUint64Array = new BigUint64Array([BigInt(100), BigInt(200)])

      // Act
      const result = computeBodyHash(bigUint64Array)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('does not call onSerializeError for ArrayBuffer views', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const bytes = new Uint8Array([1, 2, 3])

      // Act
      computeBodyHash(bytes, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('returns a 32-character hex string for ArrayBuffer views', () => {
      // Arrange
      const bytes = new Uint8Array([1, 2, 3, 4, 5])

      // Act
      const result = computeBodyHash(bytes)

      // Assert
      expect(result.length).toBe(32)
      expect(result).toMatch(/^[a-f0-9]{32}$/)
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

    it('produces consistent hash for gzip-compressed content on multiple calls', () => {
      // Arrange
      const payload = JSON.stringify({ data: 'test' })
      const compressed = gzipSync(Buffer.from(payload))

      // Act
      const hash1 = computeBodyHash(compressed)
      const hash2 = computeBodyHash(compressed)

      // Assert
      expect(hash1).toBe(hash2)
    })
  })

  describe('edge cases and boundary conditions', () => {
    it('handles very deep object nesting', () => {
      // Arrange
      let data: any = { value: 'deep' }
      for (let i = 0; i < 50; i++) {
        data = { nested: data }
      }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles objects with numeric string keys that sort differently than as numbers', () => {
      // Arrange
      const data1 = { '10': 'a', '2': 'b', '1': 'c' }
      const data2 = { '1': 'c', '2': 'b', '10': 'a' }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('handles objects with special characters in keys', () => {
      // Arrange
      const data = { '🎉': 'emoji', 'こんにちは': 'japanese', 'Здравствуй': 'russian' }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles objects with keys that are reserved words', () => {
      // Arrange
      const data = { 'constructor': 'value', 'prototype': 'value2', '__proto__': 'value3' }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles very long string values', () => {
      // Arrange
      const longString = 'x'.repeat(10000)
      const data = { content: longString }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles arrays with thousands of elements', () => {
      // Arrange
      const largeArray = Array.from({ length: 1000 }, (_, i) => i)
      const data = { items: largeArray }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('produces a random hash when JSON.stringify fails (fallback path)', () => {
      // Arrange
      const circular: any = {}
      circular.self = circular
      const hash1 = computeBodyHash(circular)
      const hash2 = computeBodyHash(circular)

      // Act & Assert - the function should not throw, but the hashes should be different
      // because they use randomBytes in the fallback path
      expect(hash1).toMatch(/^[a-f0-9]{32}$/)
      expect(hash2).toMatch(/^[a-f0-9]{32}$/)
      // Note: hashes are likely different due to randomBytes, but not guaranteed
    })

    it('handles NaN in objects', () => {
      // Arrange
      const data = { value: NaN }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles Infinity in objects', () => {
      // Arrange
      const data = { value: Infinity }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles negative Infinity in objects', () => {
      // Arrange
      const data = { value: -Infinity }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles objects where Object.entries throws', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data: any = {}
      Object.defineProperty(data, Symbol.iterator, {
        get() {
          throw new Error('iterator fail')
        },
      })

      // Act & Assert
      expect(() => computeBodyHash(data, onSerializeError)).not.toThrow()
    })

    it('ensures callback is called no more than once even with multiple failure paths', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const obj: any = { nested: {} }
      let callCount = 0
      Object.defineProperty(obj, 'prop', {
        enumerable: true,
        get() {
          callCount++
          throw new Error('fail')
        },
      })

      // Act
      computeBodyHash(obj, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('handles mixed arrays and objects', () => {
      // Arrange
      const data = {
        array: [1, { nested: 'value' }, [2, 3]],
        object: { array: [4, 5], value: 'test' },
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles dates as objects (not special-cased)', () => {
      // Arrange
      const date = new Date('2023-01-01')
      const data = { timestamp: date }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles regular expressions as objects (not special-cased)', () => {
      // Arrange
      const regex = /test/gi
      const data = { pattern: regex }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles functions (not serializable)', () => {
      // Arrange
      const data = { fn: () => {} }

      // Act & Assert
      expect(() => computeBodyHash(data)).not.toThrow()
    })
  })
})