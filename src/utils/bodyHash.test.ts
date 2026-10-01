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

  describe('raw ArrayBuffer data', () => {
    it('produces different hashes for ArrayBuffers with different contents', () => {
      const bufferA = new Uint8Array([1, 2, 3]).buffer
      const bufferB = new Uint8Array([9, 9, 9]).buffer

      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
    })

    it('hashes an ArrayBuffer the same way as a Buffer with the same bytes', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5])

      expect(computeBodyHash(bytes.buffer)).toBe(computeBodyHash(Buffer.from(bytes)))
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

    it('hashes plain objects with no special properties', () => {
      // Arrange
      const data = { name: 'test', value: 123 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes empty objects', () => {
      // Arrange
      const data = {}

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('hashes null values', () => {
      // Arrange
      const data = null
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes arrays', () => {
      // Arrange
      const data = [1, 2, 3, 4, 5]
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes empty arrays', () => {
      // Arrange
      const data: any[] = []
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes strings', () => {
      // Arrange
      const data = 'test string'
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes empty strings', () => {
      // Arrange
      const data = ''
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes numbers', () => {
      // Arrange
      const data = 42
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes zero', () => {
      // Arrange
      const data = 0
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes negative numbers', () => {
      // Arrange
      const data = -123
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes booleans (true)', () => {
      // Arrange
      const data = true
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes booleans (false)', () => {
      // Arrange
      const data = false
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes nested objects with deeply nested structures', () => {
      // Arrange
      const data = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes objects with many keys deterministically', () => {
      // Arrange
      const data = { z: 26, a: 1, m: 13, b: 2 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes arrays with mixed types', () => {
      // Arrange
      const data = [1, 'string', { key: 'value' }, true, null]
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('reports onSerializeError only once when both replacer and outer catch hit', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const always: Record<string, any> = {}
      Object.defineProperty(always, 'x', {
        enumerable: true,
        get() {
          throw new Error('fail')
        },
      })

      // Act
      computeBodyHash({ nested: always }, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('returns a 32-character hex string from fallback random bytes', () => {
      // Arrange
      const circular: Record<string, any> = {}
      circular.self = circular

      // Act
      const result = computeBodyHash(circular)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('generates different random hashes for different circular references', () => {
      // Arrange
      const circularA: Record<string, any> = { marker: 'A' }
      circularA.self = circularA
      const circularB: Record<string, any> = { marker: 'B' }
      circularB.self = circularB

      // Act
      const hashA = computeBodyHash(circularA)
      const hashB = computeBodyHash(circularB)

      // Assert
      expect(hashA).not.toBe(hashB)
      expect(hashA).toMatch(/^[a-f0-9]{32}$/)
      expect(hashB).toMatch(/^[a-f0-9]{32}$/)
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

    it('hashes empty buffer', () => {
      // Arrange
      const buffer = Buffer.from([])
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes large buffer', () => {
      // Arrange
      const buffer = Buffer.alloc(10000, 'x')
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('ignores onSerializeError callback for Buffer data', () => {
      // Arrange
      const buffer = Buffer.from([1, 2, 3])
      const onSerializeError = jest.fn()

      // Act
      computeBodyHash(buffer, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('hashes buffer with all zero bytes', () => {
      // Arrange
      const buffer = Buffer.from([0, 0, 0, 0])
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes buffer with high bytes', () => {
      // Arrange
      const buffer = Buffer.from([255, 254, 253, 252])
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
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

    it('hashes Int8Array like Buffer', () => {
      // Arrange
      const int8array = new Int8Array([1, 2, 3, 4, 5])
      const buffer = Buffer.from(int8array)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(int8array)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes Uint16Array like Buffer', () => {
      // Arrange
      const uint16array = new Uint16Array([256, 512, 1024])
      const buffer = Buffer.from(uint16array)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(uint16array)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes Int16Array like Buffer', () => {
      // Arrange
      const int16array = new Int16Array([100, -100, 500])
      const buffer = Buffer.from(int16array)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(int16array)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes Uint32Array like Buffer', () => {
      // Arrange
      const uint32array = new Uint32Array([65536, 131072])
      const buffer = Buffer.from(uint32array)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(uint32array)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes Int32Array like Buffer', () => {
      // Arrange
      const int32array = new Int32Array([100000, -100000])
      const buffer = Buffer.from(int32array)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(int32array)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes Float32Array like Buffer', () => {
      // Arrange
      const float32array = new Float32Array([1.5, 2.5, 3.5])
      const buffer = Buffer.from(float32array)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(float32array)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes Float64Array like Buffer', () => {
      // Arrange
      const float64array = new Float64Array([1.234567, 9.876543])
      const buffer = Buffer.from(float64array)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(float64array)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes DataView like Buffer', () => {
      // Arrange
      const buffer = Buffer.from([1, 2, 3, 4, 5])
      const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(dataView)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes empty Uint8Array', () => {
      // Arrange
      const bytes = new Uint8Array(0)
      const buffer = Buffer.from(bytes)
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(bytes)

      // Assert
      expect(result).toBe(expected)
    })

    it('ignores onSerializeError callback for ArrayBuffer views', () => {
      // Arrange
      const bytes = new Uint8Array([1, 2, 3])
      const onSerializeError = jest.fn()

      // Act
      computeBodyHash(bytes, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })
  })

  describe('raw ArrayBuffer data', () => {
    it('produces different hashes for ArrayBuffers with different contents', () => {
      const bufferA = new Uint8Array([1, 2, 3]).buffer
      const bufferB = new Uint8Array([9, 9, 9]).buffer

      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
    })

    it('hashes an ArrayBuffer the same way as a Buffer with the same bytes', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5])

      expect(computeBodyHash(bytes.buffer)).toBe(computeBodyHash(Buffer.from(bytes)))
    })

    it('hashes empty ArrayBuffer', () => {
      // Arrange
      const buffer = new ArrayBuffer(0)
      const expected = createHash('md5').update(Buffer.from(buffer)).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('hashes large ArrayBuffer', () => {
      // Arrange
      const buffer = new ArrayBuffer(10000)
      const expected = createHash('md5').update(Buffer.from(buffer)).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('produces consistent hash for same ArrayBuffer content', () => {
      // Arrange
      const buffer1 = new Uint8Array([1, 2, 3, 4, 5]).buffer
      const buffer2 = new Uint8Array([1, 2, 3, 4, 5]).buffer

      // Act & Assert
      expect(computeBodyHash(buffer1)).toBe(computeBodyHash(buffer2))
    })

    it('ignores onSerializeError callback for ArrayBuffer', () => {
      // Arrange
      const buffer = new Uint8Array([1, 2, 3]).buffer
      const onSerializeError = jest.fn()

      // Act
      computeBodyHash(buffer, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('hashes ArrayBuffer with all zero bytes', () => {
      // Arrange
      const buffer = new ArrayBuffer(4)
      const expected = createHash('md5').update(Buffer.from(buffer)).digest('hex')

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

  describe('edge cases and boundary conditions', () => {
    it('returns a valid hex string from computeBodyHash', () => {
      // Arrange
      const data = { test: 'value' }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles data with null values in object', () => {
      // Arrange
      const data = { a: null, b: 'value' }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles data with undefined values in object', () => {
      // Arrange
      const data = { a: undefined, b: 'value' }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles data with function values gracefully', () => {
      // Arrange
      const data = { func: () => {} }
      const onSerializeError = jest.fn()

      // Act
      const result = computeBodyHash(data, onSerializeError)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles data with Symbol values gracefully', () => {
      // Arrange
      const data = { symbol: Symbol('test') }
      const onSerializeError = jest.fn()

      // Act
      const result = computeBodyHash(data, onSerializeError)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles top-level function gracefully', () => {
      // Arrange
      const data = () => {}
      const onSerializeError = jest.fn()

      // Act
      const result = computeBodyHash(data, onSerializeError)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles top-level Symbol gracefully', () => {
      // Arrange
      const data = Symbol('test')
      const onSerializeError = jest.fn()

      // Act
      const result = computeBodyHash(data, onSerializeError)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('does not call onSerializeError for valid serializable data', () => {
      // Arrange
      const data = { valid: 'data' }
      const onSerializeError = jest.fn()

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('handles very long strings', () => {
      // Arrange
      const data = 'x'.repeat(100000)

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles very large objects with many keys', () => {
      // Arrange
      const data: Record<string, number> = {}
      for (let i = 0; i < 1000; i++) {
        data[`key_${i}`] = i
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles very large arrays', () => {
      // Arrange
      const data = Array.from({ length: 10000 }, (_, i) => i)

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('produces deterministic hash for objects with unicode characters', () => {
      // Arrange
      const data = { emoji: '🎉', chinese: '中文', arabic: 'العربية' }

      // Act
      const result1 = computeBodyHash(data)
      const result2 = computeBodyHash(data)

      // Assert
      expect(result1).toBe(result2)
    })

    it('handles objects with special key names', () => {
      // Arrange
      const data = {
        'key-with-dash': 1,
        'key.with.dot': 2,
        'key with space': 3,
        '123numeric': 4,
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles Date objects by serializing them', () => {
      // Arrange
      const date = new Date('2023-01-01T00:00:00Z')
      const data = { timestamp: date }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('produces deterministic hash for arrays containing objects with different key order', () => {
      // Arrange
      const data1 = [{ a: 1, b: 2 }, { c: 3, d: 4 }]
      const data2 = [{ b: 2, a: 1 }, { d: 4, c: 3 }]

      // Act
      const hash1 = computeBodyHash(data1)
      const hash2 = computeBodyHash(data2)

      // Assert
      expect(hash1).toBe(hash2)
    })
  })
})