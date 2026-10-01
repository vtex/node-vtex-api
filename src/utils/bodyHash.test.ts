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

import { createHash, randomBytes } from 'crypto'
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
      const onSerializeError = jest.fn()
      const alwaysFlaky: Record<string, any> = {}
      Object.defineProperty(alwaysFlaky, 'x', {
        enumerable: true,
        get() {
          throw new Error('always boom')
        },
      })

      expect(() => computeBodyHash({ nested: alwaysFlaky }, onSerializeError)).not.toThrow()
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined', () => {
      const onSerializeError = jest.fn()

      expect(() => computeBodyHash(undefined, onSerializeError)).not.toThrow()
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not throw when data is undefined and no callback is provided', () => {
      expect(() => computeBodyHash(undefined)).not.toThrow()
    })

    it('produces the same, stable hash every time data is undefined', () => {
      expect(computeBodyHash(undefined)).toBe(computeBodyHash(undefined))
    })

    it('does not collide for structurally different data that both fail to serialize (e.g. circular references)', () => {
      const circularA: Record<string, any> = { name: 'bodyA' }
      circularA.self = circularA

      const circularB: Record<string, any> = { name: 'bodyB', other: 'completely different content' }
      circularB.self = circularB

      expect(() => computeBodyHash(circularA)).not.toThrow()
      expect(() => computeBodyHash(circularB)).not.toThrow()
      expect(computeBodyHash(circularA)).not.toBe(computeBodyHash(circularB))
    })

    it('handles nested objects with deeply sorted keys', () => {
      const dataA = { z: { b: 1, a: 2 }, a: { y: 1, x: 2 } }
      const dataB = { a: { x: 2, y: 1 }, z: { a: 2, b: 1 } }

      expect(computeBodyHash(dataA)).toBe(computeBodyHash(dataB))
    })

    it('handles arrays correctly (does not sort array elements)', () => {
      const data = { items: [3, 1, 2] }

      const hash1 = computeBodyHash(data)
      const hash2 = computeBodyHash({ items: [3, 1, 2] })
      expect(hash1).toBe(hash2)

      const hashDifferent = computeBodyHash({ items: [1, 2, 3] })
      expect(hash1).not.toBe(hashDifferent)
    })

    it('handles null values in objects', () => {
      const data = { a: null, b: 2 }

      expect(() => computeBodyHash(data)).not.toThrow()
      const hash = computeBodyHash(data)
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('handles mixed types (strings, numbers, booleans)', () => {
      const data = {
        str: 'hello',
        num: 42,
        bool: true,
        float: 3.14,
      }

      expect(() => computeBodyHash(data)).not.toThrow()
      const hash = computeBodyHash(data)
      expect(typeof hash).toBe('string')
    })

    it('produces different hashes for different primitive values', () => {
      expect(computeBodyHash(1)).not.toBe(computeBodyHash(2))
      expect(computeBodyHash('a')).not.toBe(computeBodyHash('b'))
      expect(computeBodyHash(true)).not.toBe(computeBodyHash(false))
    })

    it('produces the same hash for the same string primitive', () => {
      expect(computeBodyHash('hello')).toBe(computeBodyHash('hello'))
    })

    it('produces the same hash for the same number primitive', () => {
      expect(computeBodyHash(42)).toBe(computeBodyHash(42))
    })

    it('handles empty objects', () => {
      const data = {}
      const hash = computeBodyHash(data)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('handles empty arrays', () => {
      const data: any[] = []
      const hash = computeBodyHash(data)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('handles symbol values by passing them through (JSON.stringify converts them to undefined)', () => {
      const data = { a: Symbol('test') }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles function values by passing them through (JSON.stringify converts them to undefined)', () => {
      const data = { a: () => {} }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('only reports serialization error once even if multiple failures occur', () => {
      const onSerializeError = jest.fn()
      const circularData: Record<string, any> = { a: 1 }
      circularData.self = circularData

      computeBodyHash(circularData, onSerializeError)
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('returns a hex string when serialization fails (random fallback)', () => {
      const data: Record<string, any> = {}
      Object.defineProperty(data, 'prop', {
        enumerable: true,
        get() {
          throw new Error('fail')
        },
      })

      const hash = computeBodyHash(data)

      expect(typeof hash).toBe('string')
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
      expect(hash.length).toBe(32) // 16 bytes * 2 hex chars
    })

    it('returns different hashes on subsequent calls when serialization fails (random bytes used)', () => {
      const data: Record<string, any> = {}
      Object.defineProperty(data, 'prop', {
        enumerable: true,
        get() {
          throw new Error('fail')
        },
      })

      const hash1 = computeBodyHash(data)
      const hash2 = computeBodyHash(data)

      // Different random bytes should produce different hashes
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

    it('handles empty buffer', () => {
      const emptyBuffer = Buffer.from([])
      const hash = computeBodyHash(emptyBuffer)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('handles large buffer', () => {
      const largeBuffer = Buffer.alloc(10000, 0xAB)
      const hash = computeBodyHash(largeBuffer)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(32) // MD5 hex digest is always 32 chars
    })

    it('ignores onSerializeError callback when buffer data is provided', () => {
      const onSerializeError = jest.fn()
      const buffer = Buffer.from([1, 2, 3])

      computeBodyHash(buffer, onSerializeError)
      expect(onSerializeError).not.toHaveBeenCalled()
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

    it('handles Uint8Array with empty bytes', () => {
      const emptyBytes = new Uint8Array(0)
      const hash = computeBodyHash(emptyBytes)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('handles Int8Array (another ArrayBuffer view)', () => {
      const int8 = new Int8Array([1, 2, 3, 4, 5])
      const hash = computeBodyHash(int8)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(32)
    })

    it('handles Float32Array (another ArrayBuffer view)', () => {
      const float32 = new Float32Array([1.0, 2.0, 3.0])
      const hash = computeBodyHash(float32)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(32)
    })

    it('handles DataView (another ArrayBuffer view)', () => {
      const arrayBuffer = new ArrayBuffer(8)
      const dataView = new DataView(arrayBuffer)
      dataView.setInt32(0, 42, true)

      const hash = computeBodyHash(dataView)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(32)
    })
  })

  describe('gzip-compressed body across separate requests (render-ssr scenario)', () => {
    it('produces the same hash when the same JSON payload is gzip-compressed independently twice', () => {
      const payload = JSON.stringify({ page: 'home', props: { locale: 'en-US', items: [1, 2, 3] } })

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

  describe('edge cases and corner scenarios', () => {
    it('handles very deep nested object structures', () => {
      let deep: any = { value: 1 }
      for (let i = 0; i < 100; i++) {
        deep = { nested: deep }
      }

      expect(() => computeBodyHash(deep)).not.toThrow()
    })

    it('handles objects with many properties', () => {
      const manyProps: Record<string, number> = {}
      for (let i = 0; i < 1000; i++) {
        manyProps[`key${i}`] = i
      }

      expect(() => computeBodyHash(manyProps)).not.toThrow()
    })

    it('handles special numeric values', () => {
      expect(() => computeBodyHash({ inf: Infinity })).not.toThrow()
      expect(() => computeBodyHash({ negInf: -Infinity })).not.toThrow()
      expect(() => computeBodyHash({ nan: NaN })).not.toThrow()
    })

    it('handles Date objects (which JSON.stringify converts to ISO strings)', () => {
      const data = { timestamp: new Date('2024-01-01T00:00:00Z') }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles RegExp objects (which JSON.stringify converts to empty objects)', () => {
      const data = { pattern: /test/gi }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles custom objects with toJSON method', () => {
      class CustomObject {
        toJSON() {
          return { serialized: true }
        }
      }

      const data = { custom: new CustomObject() }
      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles string with special characters', () => {
      const data = { text: 'Hello\nWorld\t\"quoted\"' }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles unicode characters in strings', () => {
      const data = { text: '你好世界🌍' }

      expect(() => computeBodyHash(data)).not.toThrow()
    })

    it('handles boolean primitives', () => {
      expect(() => computeBodyHash(true)).not.toThrow()
      expect(() => computeBodyHash(false)).not.toThrow()
    })

    it('handles null as top-level data', () => {
      expect(() => computeBodyHash(null)).not.toThrow()
    })

    it('handles 0 as top-level data', () => {
      expect(() => computeBodyHash(0)).not.toThrow()
    })

    it('handles empty string as top-level data', () => {
      expect(() => computeBodyHash('')).not.toThrow()
    })

    it('handles false as top-level data', () => {
      expect(() => computeBodyHash(false)).not.toThrow()
    })

    it('returns a valid hex string in all cases', () => {
      const testCases = [
        { a: 1 },
        Buffer.from([1, 2, 3]),
        new Uint8Array([1, 2, 3]),
        undefined,
        'string',
        42,
        true,
        null,
      ]

      testCases.forEach(testCase => {
        const hash = computeBodyHash(testCase)
        expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
        expect(hash.length).toBe(32) // MD5 hex is always 32 chars
      })
    })
  })

  describe('deterministic replacer behavior', () => {
    it('sorts keys alphabetically in nested objects', () => {
      const data1 = { z: { z: 1, a: 1 }, a: { z: 1, a: 1 } }
      const data2 = { a: { a: 1, z: 1 }, z: { a: 1, z: 1 } }

      expect(computeBodyHash(data1)).toBe(computeBodyHash(data2))
    })

    it('maintains consistent behavior across multiple sort operations', () => {
      const complexData = {
        z: { c: 3, b: 2, a: 1 },
        a: { c: 3, b: 2, a: 1 },
        m: { c: 3, b: 2, a: 1 },
      }

      const hash1 = computeBodyHash(complexData)
      const hash2 = computeBodyHash(complexData)
      const hash3 = computeBodyHash(complexData)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })
  })

  describe('onSerializeError callback behavior', () => {
    it('calls onSerializeError only once per invocation', () => {
      const onSerializeError = jest.fn()
      const data: Record<string, any> = {}
      Object.defineProperty(data, 'prop', {
        enumerable: true,
        get() {
          throw new Error('fail')
        },
      })

      computeBodyHash(data, onSerializeError)
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not call onSerializeError for successful serializations', () => {
      const onSerializeError = jest.fn()
      computeBodyHash({ a: 1, b: 2 }, onSerializeError)
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not call onSerializeError when data is undefined', () => {
      const onSerializeError = jest.fn()
      computeBodyHash(undefined, onSerializeError)
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not call onSerializeError when data is ArrayBuffer view', () => {
      const onSerializeError = jest.fn()
      computeBodyHash(Buffer.from([1, 2, 3]), onSerializeError)
      expect(onSerializeError).not.toHaveBeenCalled()
    })
  })
})