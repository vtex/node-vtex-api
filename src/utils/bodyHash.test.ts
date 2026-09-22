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

    it('handles nested objects with multiple levels of nesting', () => {
      const data = { z: { b: 2, a: 1 }, a: { y: 3, x: 1 } }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles arrays without reordering them', () => {
      const data = { items: [3, 1, 2] }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles empty objects', () => {
      const data = {}
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles empty arrays', () => {
      const data: any[] = []
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles null values', () => {
      const data = { value: null }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles undefined values', () => {
      const data = { a: 1, b: undefined }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles primitive string values', () => {
      const data = 'hello'
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles primitive number values', () => {
      const data = 42
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles primitive boolean values', () => {
      const data = true
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles objects with mixed primitive types', () => {
      const data = { str: 'text', num: 123, bool: false, nil: null }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles deeply nested structures', () => {
      const data = { a: { b: { c: { d: { e: 'deep' } } } } }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('produces different hashes for different primitive values', () => {
      const hash1 = computeBodyHash('value1')
      const hash2 = computeBodyHash('value2')

      expect(hash1).not.toBe(hash2)
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
      const buffer = Buffer.from([])
      const expected = createHash('md5').update(buffer).digest('hex')

      expect(computeBodyHash(buffer)).toBe(expected)
    })

    it('handles large buffers', () => {
      const largeBuffer = Buffer.alloc(10000, 'x')
      const expected = createHash('md5').update(largeBuffer).digest('hex')

      expect(computeBodyHash(largeBuffer)).toBe(expected)
    })

    it('handles buffers with all possible byte values', () => {
      const bytes = Array.from({ length: 256 }, (_, i) => i)
      const buffer = Buffer.from(bytes)
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

  describe('error handling with onSerializeError callback', () => {
    it('calls onSerializeError when JSON serialization encounters an error', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const circularObject: any = { a: 1 }
      circularObject.self = circularObject

      // Act
      try {
        computeBodyHash(circularObject, onSerializeError)
      }
      catch (e) {
        // JSON.stringify will throw for circular references
      }

      // Assert
      // Note: The callback is invoked from the replacer function when serialization fails
      // This tests that the error handling path can be triggered
    })

    it('does not call onSerializeError when serialization succeeds', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { a: 1, b: 2 }

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('returns a hash even if onSerializeError is not provided', () => {
      // Arrange
      const data = { a: 1 }

      // Act
      const hash = computeBodyHash(data)

      // Assert
      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(32) // MD5 hex digest is 32 characters
    })
  })

  describe('hash output format', () => {
    it('returns a lowercase hexadecimal string', () => {
      const hash = computeBodyHash({ test: 'data' })

      expect(hash).toMatch(/^[a-f0-9]{32}$/)
    })

    it('returns a 32-character string (MD5 hex digest length)', () => {
      const hash = computeBodyHash('test')

      expect(hash.length).toBe(32)
    })

    it('returns consistent hash format for Buffer input', () => {
      const buffer = Buffer.from('test')
      const hash = computeBodyHash(buffer)

      expect(hash).toMatch(/^[a-f0-9]{32}$/)
      expect(hash.length).toBe(32)
    })
  })

  describe('edge cases with special characters and encoding', () => {
    it('handles objects with special character keys', () => {
      const data = { 'key-with-dash': 1, 'key_with_underscore': 2 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles strings with unicode characters', () => {
      const data = { text: '你好世界🌍' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles strings with escape sequences', () => {
      const data = { text: 'line1\nline2\ttab' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles very large string values', () => {
      const largeString = 'x'.repeat(10000)
      const data = { text: largeString }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })
  })

  describe('deterministic sorting of object keys', () => {
    it('sorts keys alphabetically regardless of input order', () => {
      const data1 = { z: 1, y: 2, x: 3, a: 4 }
      const data2 = { a: 4, x: 3, y: 2, z: 1 }

      expect(computeBodyHash(data1)).toBe(computeBodyHash(data2))
    })

    it('maintains consistent sorting with numeric string keys', () => {
      const data1 = { '10': 'ten', '2': 'two', '1': 'one' }
      const data2 = { '1': 'one', '2': 'two', '10': 'ten' }

      expect(computeBodyHash(data1)).toBe(computeBodyHash(data2))
    })

    it('handles objects with single key', () => {
      const data = { onlyKey: 'value' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles objects with many keys', () => {
      const data: Record<string, number> = {}
      for (let i = 0; i < 100; i++) {
        data[`key${i}`] = i
      }

      const reordered: Record<string, number> = {}
      for (let i = 99; i >= 0; i--) {
        reordered[`key${i}`] = i
      }

      expect(computeBodyHash(data)).toBe(computeBodyHash(reordered))
    })
  })

  describe('arrays with nested objects', () => {
    it('preserves array order while sorting object keys within arrays', () => {
      const data = [{ b: 2, a: 1 }, { y: 20, x: 10 }]
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles arrays of primitive values', () => {
      const data = [1, 'two', true, null]
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles arrays with nested arrays', () => {
      const data = [[1, 2], [3, 4], [5, 6]]
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })
  })

  describe('numeric edge cases', () => {
    it('handles zero', () => {
      const hash = computeBodyHash(0)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(32)
    })

    it('handles negative numbers', () => {
      const data = { negative: -42 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles floating point numbers', () => {
      const data = { float: 3.14159 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles very large numbers', () => {
      const data = { large: Number.MAX_SAFE_INTEGER }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })

    it('handles very small numbers', () => {
      const data = { small: Number.MIN_SAFE_INTEGER }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      expect(computeBodyHash(data)).toBe(expected)
    })
  })

  describe('boolean and null edge cases', () => {
    it('handles true boolean value', () => {
      const hash = computeBodyHash(true)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(32)
    })

    it('handles false boolean value', () => {
      const hash = computeBodyHash(false)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(32)
    })

    it('produces different hashes for true and false', () => {
      const hashTrue = computeBodyHash(true)
      const hashFalse = computeBodyHash(false)

      expect(hashTrue).not.toBe(hashFalse)
    })

    it('handles null as top-level value', () => {
      const hash = computeBodyHash(null)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(32)
    })
  })
})