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
      expect(onSerializeError).toHaveBeenCalled()
    })

    it('does not throw when data is undefined', () => {
      const onSerializeError = jest.fn()

      expect(() => computeBodyHash(undefined, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined and no callback is provided', () => {
      expect(() => computeBodyHash(undefined)).not.toThrow()
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

      // Act
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
      expect(onSerializeError).toHaveBeenCalled()
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

    it('returns a valid hex string for simple objects', () => {
      // Arrange
      const data = { key: 'value' }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('returns a valid hex string for primitive values', () => {
      // Arrange & Act
      const resultString = computeBodyHash('test')
      const resultNumber = computeBodyHash(42)
      const resultBoolean = computeBodyHash(true)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(resultString)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(resultNumber)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(resultBoolean)).toBe(true)
    })

    it('handles null values without error', () => {
      // Arrange
      const onSerializeError = jest.fn()

      // Act
      expect(() => computeBodyHash(null, onSerializeError)).not.toThrow()

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('handles empty objects', () => {
      // Arrange
      const data = {}

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles empty arrays', () => {
      // Arrange
      const data: any[] = []

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles nested objects with multiple levels', () => {
      // Arrange
      const data = {
        level1: {
          level2: {
            level3: { value: 'deep' }
          }
        }
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles arrays with mixed types', () => {
      // Arrange
      const data = [1, 'string', true, null, { key: 'value' }]

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('produces different hashes for different object content', () => {
      // Arrange
      const data1 = { a: 1 }
      const data2 = { a: 2 }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).not.toBe(hash2)
    })

    it('handles special string values', () => {
      // Arrange & Act
      const emptyString = computeBodyHash('')
      const specialChars = computeBodyHash('!@#$%^&*()')
      const newlines = computeBodyHash('line1\nline2')

      // Assert
      expect(/^[a-f0-9]{32}$/.test(emptyString)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(specialChars)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(newlines)).toBe(true)
    })

    it('handles numeric edge cases', () => {
      // Arrange & Act
      const zero = computeBodyHash(0)
      const negative = computeBodyHash(-42)
      const float = computeBodyHash(3.14159)
      const infinity = computeBodyHash(Infinity)
      const nan = computeBodyHash(NaN)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(zero)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(negative)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(float)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(infinity)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(nan)).toBe(true)
    })

    it('calls onSerializeError callback when JSON.stringify fails', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const circularRef: any = {}
      circularRef.self = circularRef

      // Act
      expect(() => computeBodyHash(circularRef, onSerializeError)).not.toThrow()

      // Assert
      expect(onSerializeError).toHaveBeenCalled()
    })

    it('handles objects with symbol properties (which are non-enumerable by default)', () => {
      // Arrange
      const data = { a: 1, b: 2 }
      Object.defineProperty(data, Symbol('hidden'), { value: 'should not appear' })

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles objects with getters that return different values each time', () => {
      // Arrange
      const onSerializeError = jest.fn()
      let callCount = 0
      const data: Record<string, any> = {}
      Object.defineProperty(data, 'x', {
        enumerable: true,
        get() {
          return callCount++
        },
      })

      // Act
      expect(() => computeBodyHash(data, onSerializeError)).not.toThrow()

      // Assert
      const result = computeBodyHash(data)
      expect(typeof result).toBe('string')
    })

    it('returns consistent hash for the same data on multiple calls', () => {
      // Arrange
      const data = { a: 1, b: { c: 2 } }

      // Act
      const hash1 = computeBodyHash(data)
      const hash2 = computeBodyHash(data)
      const hash3 = computeBodyHash(data)

      // Assert
      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('deterministically sorts object keys regardless of insertion order', () => {
      // Arrange
      const data1 = { z: 26, a: 1, m: 13 }
      const data2 = { a: 1, m: 13, z: 26 }
      const data3 = { m: 13, z: 26, a: 1 }

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)
      const hash3 = computeBodyHash(data3)

      // Assert
      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('handles data with only undefined properties after replacer runs', () => {
      // Arrange
      const data = { x: undefined }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
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

    it('returns a valid 32-character hex string for buffers', () => {
      // Arrange
      const buffer = Buffer.from('test data')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles empty buffers', () => {
      // Arrange
      const buffer = Buffer.alloc(0)

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles large buffers', () => {
      // Arrange
      const largeBuffer = Buffer.alloc(1024 * 1024) // 1MB
      largeBuffer.fill('a')

      // Act
      const result = computeBodyHash(largeBuffer)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('does not call onSerializeError when hashing buffers', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const buffer = Buffer.from([1, 2, 3])

      // Act
      computeBodyHash(buffer, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('handles buffers created from different sources', () => {
      // Arrange
      const bufferFromArray = Buffer.from([65, 66, 67])
      const bufferFromString = Buffer.from('ABC')
      const bufferFromEncoding = Buffer.from('ABC', 'utf8')

      // Act
      const hashArray = computeBodyHash(bufferFromArray)
      const hashString = computeBodyHash(bufferFromString)
      const hashEncoding = computeBodyHash(bufferFromEncoding)

      // Assert
      expect(hashArray).toBe(hashString)
      expect(hashString).toBe(hashEncoding)
    })

    it('handles buffers with binary data', () => {
      // Arrange
      const binaryBuffer = Buffer.from([0, 127, 128, 255])

      // Act
      const result = computeBodyHash(binaryBuffer)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('returns consistent hash for the same buffer content across multiple calls', () => {
      // Arrange
      const bufferA = Buffer.from([1, 2, 3])
      const bufferB = Buffer.from([1, 2, 3])

      // Act
      const hash1 = computeBodyHash(bufferA)
      const hash2 = computeBodyHash(bufferB)
      const hash3 = computeBodyHash(bufferA)

      // Assert
      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
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

  describe('edge cases and error handling', () => {
    it('handles data with toJSON method', () => {
      // Arrange
      const data = {
        value: 42,
        toJSON() {
          return { custom: 'representation' }
        }
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles error in replacer without crashing', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = {
        get broken() {
          throw new Error('Intentional error')
        }
      }

      // Act & Assert
      expect(() => computeBodyHash(data, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalled()
    })

    it('handles Date objects', () => {
      // Arrange
      const date = new Date('2024-01-01T00:00:00Z')
      const data = { timestamp: date }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles RegExp objects', () => {
      // Arrange
      const regex = /test/gi
      const data = { pattern: regex }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles Map and Set objects', () => {
      // Arrange
      const map = new Map([['a', 1], ['b', 2]])
      const set = new Set([1, 2, 3])

      // Act
      const resultMap = computeBodyHash(map)
      const resultSet = computeBodyHash(set)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(resultMap)).toBe(true)
      expect(/^[a-f0-9]{32}$/.test(resultSet)).toBe(true)
    })

    it('handles Error objects', () => {
      // Arrange
      const error = new Error('test error')
      const data = { error }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('does not call onSerializeError when no error occurs', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { a: 1, b: 2, c: 3 }

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('recovers gracefully from getter that sometimes throws', () => {
      // Arrange
      const onSerializeError = jest.fn()
      let callCount = 0
      const data: Record<string, any> = {}
      Object.defineProperty(data, 'unstable', {
        enumerable: true,
        get() {
          callCount++
          if (callCount % 2 === 1) {
            throw new Error('odd call')
          }
          return 'value'
        }
      })

      // Act
      const result = computeBodyHash(data, onSerializeError)

      // Assert
      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles frozen objects', () => {
      // Arrange
      const data = Object.freeze({ a: 1, b: 2 })

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles sealed objects', () => {
      // Arrange
      const data = Object.seal({ a: 1, b: 2 })

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('handles objects with non-configurable properties', () => {
      // Arrange
      const data: Record<string, any> = {}
      Object.defineProperty(data, 'fixed', {
        value: 'immutable',
        configurable: false
      })

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(/^[a-f0-9]{32}$/.test(result)).toBe(true)
    })

    it('produces the same hash for arrays with identical elements regardless of order considered by replacer', () => {
      // Arrange
      const array = [{ b: 2, a: 1 }, { d: 4, c: 3 }]

      // Act
      const hash1 = computeBodyHash(array)
      // Arrays maintain order, so this should be different
      const array2 = [{ d: 4, c: 3 }, { b: 2, a: 1 }]
      const hash2 = computeBodyHash(array2)

      // Assert
      expect(hash1).not.toBe(hash2) // Different array order
    })
  })
})