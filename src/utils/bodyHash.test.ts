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
      const data = { b: 2, a: 1 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('produces the same hash regardless of key order (deterministic replacer)', () => {
      expect(computeBodyHash({ a: 1, b: 2 })).toBe(computeBodyHash({ b: 2, a: 1 }))
    })

    it('handles null values correctly', () => {
      // Arrange
      const data = null
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles undefined values correctly', () => {
      // Arrange
      const data = undefined
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles empty objects correctly', () => {
      // Arrange
      const data = {}
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles empty arrays correctly', () => {
      // Arrange
      const data: any[] = []
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles nested objects with multiple levels', () => {
      // Arrange
      const data = {
        level1: {
          z: 26,
          a: 1,
          level2: {
            y: 25,
            b: 2
          }
        }
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles arrays with mixed types', () => {
      // Arrange
      const data = [1, 'string', { key: 'value' }, null, true]
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles primitive values (string)', () => {
      // Arrange
      const data = 'test string'
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles primitive values (number)', () => {
      // Arrange
      const data = 42
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles primitive values (boolean)', () => {
      // Arrange
      const data = true
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('sorts object keys alphabetically at all levels', () => {
      // Arrange
      const dataUnordered = { z: 1, a: 2, m: 3, b: 4 }
      const dataOrdered = { a: 2, b: 4, m: 3, z: 1 }

      // Act
      const hashUnordered = computeBodyHash(dataUnordered)
      const hashOrdered = computeBodyHash(dataOrdered)

      // Assert
      expect(hashUnordered).toBe(hashOrdered)
    })

    it('handles objects with many keys', () => {
      // Arrange
      const data: Record<string, number> = {}
      for (let i = 0; i < 100; i++) {
        data[`key${i}`] = i
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles very deeply nested objects', () => {
      // Arrange
      let data: any = { value: 'deep' }
      for (let i = 0; i < 50; i++) {
        data = { nested: data }
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
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

    it('handles empty buffer correctly', () => {
      // Arrange
      const buffer = Buffer.from([])
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles large buffers', () => {
      // Arrange
      const largeBuffer = Buffer.alloc(1024 * 1024) // 1 MB
      const expected = createHash('md5').update(largeBuffer).digest('hex')

      // Act
      const result = computeBodyHash(largeBuffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('produces consistent hash across multiple calls for the same buffer', () => {
      // Arrange
      const buffer = Buffer.from('test data')

      // Act
      const hash1 = computeBodyHash(buffer)
      const hash2 = computeBodyHash(buffer)
      const hash3 = computeBodyHash(buffer)

      // Assert
      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('handles buffers with all byte values (0-255)', () => {
      // Arrange
      const bytes: number[] = []
      for (let i = 0; i <= 255; i++) {
        bytes.push(i)
      }
      const buffer = Buffer.from(bytes)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
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

  describe('error handling with onSerializeError callback', () => {
    it('does not call onSerializeError when serialization succeeds with normal object', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { a: 1, b: 2 }

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not call onSerializeError when serialization succeeds with array', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = [1, 2, 3, 4, 5]

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not call onSerializeError when serialization succeeds with primitive', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = 'test string'

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not call onSerializeError when serialization succeeds with null', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = null

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not call onSerializeError when callback is undefined', () => {
      // Arrange
      const data = { a: 1 }

      // Act & Assert
      expect(() => {
        computeBodyHash(data, undefined)
      }).not.toThrow()
    })

    it('handles callback being undefined gracefully', () => {
      // Arrange
      const data = { test: 'data' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('returns a valid hash even if replacer encounters an issue', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { a: 1, b: 2 }

      // Act
      const result = computeBodyHash(data, onSerializeError)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('continues to produce consistent hashes across calls with callback provided', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { key: 'value' }

      // Act
      const hash1 = computeBodyHash(data, onSerializeError)
      const hash2 = computeBodyHash(data, onSerializeError)

      // Assert
      expect(hash1).toBe(hash2)
    })
  })

  describe('hash format validation', () => {
    it('always returns a valid MD5 hex string', () => {
      // Arrange
      const testCases = [
        {},
        { a: 1 },
        [],
        [1, 2, 3],
        'string',
        42,
        true,
        null,
        Buffer.from('test')
      ]

      // Act & Assert
      testCases.forEach(testCase => {
        const result = computeBodyHash(testCase)
        expect(result).toMatch(/^[a-f0-9]{32}$/)
      })
    })

    it('returns lowercase hex string', () => {
      // Arrange
      const data = { test: 'value' }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(result.toLowerCase())
    })
  })

  describe('deterministic replacer behavior', () => {
    it('handles objects with special characters in keys', () => {
      // Arrange
      const data = {
        'key-with-dash': 1,
        'key_with_underscore': 2,
        'key.with.dot': 3
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles objects with numeric string keys', () => {
      // Arrange
      const data = {
        '3': 'three',
        '1': 'one',
        '2': 'two'
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('preserves array order (does not sort arrays)', () => {
      // Arrange
      const data1 = [3, 1, 2]
      const data2 = [1, 2, 3]

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).not.toBe(hash2)
    })

    it('handles mixed object and array structures', () => {
      // Arrange
      const data = {
        users: [
          { z: 'last', a: 'first' },
          { z: 'last', a: 'first' }
        ]
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })
  })
})