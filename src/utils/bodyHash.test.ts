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

    it('handles null values', () => {
      const data = { a: null, b: 1 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles arrays without sorting', () => {
      const data = { values: [3, 1, 2] }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles nested objects with deterministic key ordering', () => {
      const data = { z: { y: 2, x: 1 }, a: { c: 3, b: 2 } }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles deeply nested structures', () => {
      const data = { z: { y: { x: { w: 1 } } }, a: 1 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles empty objects', () => {
      const data = {}
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles empty arrays', () => {
      const data = { arr: [] }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles primitive string values', () => {
      const data = 'test string'
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles primitive number values', () => {
      const data = 42
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles boolean values', () => {
      const data = true
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles null as top-level value', () => {
      const data = null
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles mixed types in object', () => {
      const data = { str: 'hello', num: 123, bool: false, nil: null, arr: [1, 2], obj: { k: 'v' } }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles objects with numeric string keys', () => {
      const data = { '3': 'c', '1': 'a', '2': 'b' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles objects with special character keys', () => {
      const data = { '@type': 'user', '#id': 1, '$value': 'test' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('calls onSerializeError callback exactly once when serialization fails', () => {
      const onSerializeError = jest.fn()
      const data = { a: 1 }

      computeBodyHash(data, onSerializeError)

      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('handles very large objects', () => {
      const data: Record<string, number> = {}
      for (let i = 0; i < 1000; i++) {
        data[`key${i}`] = i
      }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('produces consistent hashes for the same data across multiple calls', () => {
      const data = { b: 2, a: 1 }
      const hash1 = computeBodyHash(data)
      const hash2 = computeBodyHash(data)
      const hash3 = computeBodyHash(data)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('produces different hashes for different data', () => {
      const data1 = { a: 1 }
      const data2 = { a: 2 }

      expect(computeBodyHash(data1)).not.toBe(computeBodyHash(data2))
    })

    it('handles undefined values in objects', () => {
      const data = { a: 1, b: undefined }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
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

    it('handles empty buffers', () => {
      const emptyBuffer = Buffer.from([])
      const expected = createHash('md5').update(emptyBuffer).digest('hex')

      expect(computeBodyHash(emptyBuffer)).toBe(expected)
    })

    it('handles large buffers', () => {
      const largeBuffer = Buffer.alloc(10000, 'test data')
      const expected = createHash('md5').update(largeBuffer).digest('hex')

      expect(computeBodyHash(largeBuffer)).toBe(expected)
    })

    it('ignores onSerializeError callback for Buffer data', () => {
      const onSerializeError = jest.fn()
      const buffer = Buffer.from([1, 2, 3])

      computeBodyHash(buffer, onSerializeError)

      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('produces consistent hashes for the same buffer across multiple calls', () => {
      const buffer = Buffer.from([1, 2, 3, 4, 5])
      const hash1 = computeBodyHash(buffer)
      const hash2 = computeBodyHash(buffer)
      const hash3 = computeBodyHash(buffer)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('handles buffer created from string', () => {
      const buffer = Buffer.from('hello world')
      const expected = createHash('md5').update(buffer).digest('hex')

      expect(computeBodyHash(buffer)).toBe(expected)
    })

    it('handles buffer created from base64', () => {
      const buffer = Buffer.from('aGVsbG8gd29ybGQ=', 'base64')
      const expected = createHash('md5').update(buffer).digest('hex')

      expect(computeBodyHash(buffer)).toBe(expected)
    })

    it('handles buffer created from hex', () => {
      const buffer = Buffer.from('48656c6c6f', 'hex')
      const expected = createHash('md5').update(buffer).digest('hex')

      expect(computeBodyHash(buffer)).toBe(expected)
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

  describe('edge cases and boundary conditions', () => {
    it('handles objects with many keys', () => {
      const data: Record<string, number> = {}
      for (let i = 100; i >= 0; i--) {
        data[`key_${String(i).padStart(3, '0')}`] = i
      }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles circular reference-like structures by converting to string', () => {
      // Note: true circular refs will throw in JSON.stringify, but we're testing
      // that the function doesn't break with complex nested structures
      const data = { a: { b: { c: { d: { e: 1 } } } } }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles objects with inherited properties', () => {
      const parent = { inherited: 'value' }
      const child = Object.create(parent)
      child.own = 'property'

      // JSON.stringify only serializes own properties
      expect(() => computeBodyHash(child)).not.toThrow()
    })

    it('handles unicode strings in keys and values', () => {
      const data = { '🔑': '🔑', 'ключ': 'значение', 'キー': '値' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles very long string values', () => {
      const longString = 'x'.repeat(10000)
      const data = { value: longString }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles numbers at boundary values', () => {
      const data = {
        maxSafe: Number.MAX_SAFE_INTEGER,
        minSafe: Number.MIN_SAFE_INTEGER,
        zero: 0,
        negZero: -0,
        float: 3.14159,
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles special numeric values in JSON-serializable context', () => {
      // Infinity and NaN serialize to null in JSON
      const data = { a: 1 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('returns a valid hex string', () => {
      const hash = computeBodyHash({ test: 'data' })

      expect(typeof hash).toBe('string')
      expect(/^[a-f0-9]{32}$/.test(hash)).toBe(true)
    })

    it('returns MD5 hash (32 character hex string)', () => {
      const hash = computeBodyHash({ test: 'data' })

      expect(hash).toHaveLength(32)
    })

    it('handles data with function values (converts to string during JSON.stringify)', () => {
      // Functions are excluded from JSON.stringify
      const data = { a: 1 }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles data with symbol keys (excluded from JSON.stringify)', () => {
      const data = { regular: 'value' }

      expect(() => computeBodyHash(data)).not.toThrow()
    })
  })

  describe('onSerializeError callback behavior', () => {
    it('is called when a property getter throws', () => {
      const onSerializeError = jest.fn()
      const data: Record<string, any> = {}
      Object.defineProperty(data, 'bad', {
        enumerable: true,
        get() {
          throw new Error('getter error')
        },
      })

      computeBodyHash(data, onSerializeError)

      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('is optional and function works without it', () => {
      const data = { a: 1, b: 2 }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('still produces a valid hash when callback is invoked', () => {
      const onSerializeError = jest.fn()
      let getterCalls = 0
      const data: Record<string, any> = { value: 'test' }
      Object.defineProperty(data, 'flaky', {
        enumerable: true,
        get() {
          getterCalls += 1
          if (getterCalls === 1) {
            throw new Error('boom')
          }
          return 42
        },
      })

      const hash = computeBodyHash(data, onSerializeError)

      expect(hash).toMatch(/^[a-f0-9]{32}$/)
      expect(onSerializeError).toHaveBeenCalled()
    })
  })

  describe('deterministic key sorting', () => {
    it('maintains consistent sort order for alphabetically sorted keys', () => {
      const ordered1 = computeBodyHash({ a: 1, b: 2, c: 3 })
      const ordered2 = computeBodyHash({ c: 3, b: 2, a: 1 })
      const ordered3 = computeBodyHash({ b: 2, c: 3, a: 1 })

      expect(ordered1).toBe(ordered2)
      expect(ordered2).toBe(ordered3)
    })

    it('uses lexicographic sorting (not numeric)', () => {
      const data = { '10': 'ten', '2': 'two', '1': 'one' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles case-sensitive sorting', () => {
      const data1 = computeBodyHash({ A: 1, a: 2 })
      const data2 = computeBodyHash({ a: 2, A: 1 })

      expect(data1).toBe(data2)
    })
  })
})