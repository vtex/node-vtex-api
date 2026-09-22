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

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(),
}))

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
      // Act & Assert
      expect(computeBodyHash({ a: 1, b: 2 })).toBe(computeBodyHash({ b: 2, a: 1 }))
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
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when data is undefined', () => {
      // Arrange
      const onSerializeError = jest.fn()

      // Act & Assert
      expect(() => computeBodyHash(undefined, onSerializeError)).not.toThrow()
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('does not throw when data is undefined and no callback is provided', () => {
      // Act & Assert
      expect(() => computeBodyHash(undefined)).not.toThrow()
    })

    it('produces the same, stable hash every time data is undefined', () => {
      // Act & Assert
      expect(computeBodyHash(undefined)).toBe(computeBodyHash(undefined))
    })

    it('does not collide for structurally different data that both fail to serialize (e.g. circular references)', () => {
      // Arrange
      const circularA: Record<string, any> = { name: 'bodyA' }
      circularA.self = circularA

      const circularB: Record<string, any> = { name: 'bodyB', other: 'completely different content' }
      circularB.self = circularB

      // Act & Assert
      expect(() => computeBodyHash(circularA)).not.toThrow()
      expect(() => computeBodyHash(circularB)).not.toThrow()
      expect(computeBodyHash(circularA)).not.toBe(computeBodyHash(circularB))
    })

    it('handles null data correctly', () => {
      // Act
      const result = computeBodyHash(null)

      // Assert
      expect(result).toBe(createHash('md5').update(JSON.stringify(null, deterministicReplacer)).digest('hex'))
    })

    it('handles array data correctly', () => {
      // Arrange
      const data = [1, 2, 3]
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles boolean data correctly', () => {
      // Arrange
      const data = true
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles number data correctly', () => {
      // Arrange
      const data = 42
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles string data correctly', () => {
      // Arrange
      const data = 'hello world'
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles deeply nested objects with multiple keys', () => {
      // Arrange
      const data = {
        z: { y: { x: 1, w: 2 }, v: 3 },
        a: [1, 2, 3],
        m: 'value',
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles objects with numeric string keys', () => {
      // Arrange
      const data = { '2': 'b', '1': 'a', '10': 'c' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles empty objects', () => {
      // Arrange
      const data = {}
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles empty arrays', () => {
      // Arrange
      const data: any[] = []
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('calls onSerializeError callback exactly once when both replacer and outer stringify fail', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const alwaysFlaky: Record<string, any> = {}
      Object.defineProperty(alwaysFlaky, 'x', {
        enumerable: true,
        get() {
          throw new Error('always boom')
        },
      })

      // Act
      computeBodyHash({ nested: alwaysFlaky }, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not call onSerializeError for successful serialization', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { a: 1, b: 2 }

      // Act
      computeBodyHash(data, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('returns a hex string of expected length', () => {
      // Act
      const result = computeBodyHash({ test: 'data' })

      // Assert
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles objects with symbol keys (which are not enumerable by Object.entries)', () => {
      // Arrange
      const sym = Symbol('test')
      const data: any = { a: 1, b: 2 }
      data[sym] = 'not enumerable'
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })
  })

  describe('Buffer data', () => {
    it('produces the same hash for two buffers with identical bytes', () => {
      // Arrange
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 5])

      // Act & Assert
      expect(computeBodyHash(bufferA)).toBe(computeBodyHash(bufferB))
    })

    it('produces different hashes for buffers with different bytes', () => {
      // Arrange
      const bufferA = Buffer.from([1, 2, 3, 4, 5])
      const bufferB = Buffer.from([1, 2, 3, 4, 6])

      // Act & Assert
      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
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

    it('does not call onSerializeError callback for buffer data', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const buffer = Buffer.from([1, 2, 3, 4, 5])

      // Act
      computeBodyHash(buffer, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })

    it('handles empty buffer', () => {
      // Arrange
      const buffer = Buffer.from([])
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles buffer with single byte', () => {
      // Arrange
      const buffer = Buffer.from([255])
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles buffer with large content', () => {
      // Arrange
      const buffer = Buffer.alloc(10000, 'a')
      const expected = createHash('md5').update(buffer).digest('hex')

      // Act
      const result = computeBodyHash(buffer)

      // Assert
      expect(result).toBe(expected)
    })
  })

  describe('other ArrayBuffer views (e.g. Uint8Array)', () => {
    it('hashes a Uint8Array the same way as the equivalent Buffer', () => {
      // Arrange
      const bytes = new Uint8Array([1, 2, 3, 4, 5])

      // Act & Assert
      expect(computeBodyHash(bytes)).toBe(computeBodyHash(Buffer.from(bytes)))
    })

    it('produces different hashes for Uint8Arrays with different bytes', () => {
      // Arrange
      const bytesA = new Uint8Array([1, 2, 3, 4, 5])
      const bytesB = new Uint8Array([1, 2, 3, 4, 6])

      // Act & Assert
      expect(computeBodyHash(bytesA)).not.toBe(computeBodyHash(bytesB))
    })

    it('handles DataView correctly', () => {
      // Arrange
      const buffer = Buffer.from([1, 2, 3, 4, 5])
      const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      const expected = createHash('md5').update(Buffer.from(buffer)).digest('hex')

      // Act
      const result = computeBodyHash(dataView)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles Int8Array correctly', () => {
      // Arrange
      const typed = new Int8Array([1, 2, 3, 4, 5])
      const expected = createHash('md5').update(Buffer.from(typed)).digest('hex')

      // Act
      const result = computeBodyHash(typed)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles Float32Array correctly', () => {
      // Arrange
      const typed = new Float32Array([1.5, 2.5, 3.5])
      const expected = createHash('md5').update(Buffer.from(typed)).digest('hex')

      // Act
      const result = computeBodyHash(typed)

      // Assert
      expect(result).toBe(expected)
    })

    it('does not call onSerializeError callback for Uint8Array data', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const bytes = new Uint8Array([1, 2, 3, 4, 5])

      // Act
      computeBodyHash(bytes, onSerializeError)

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

      // Act & Assert
      expect(bufferFromRequestA.equals(bufferFromRequestB)).toBe(true)
      expect(computeBodyHash(bufferFromRequestA)).toBe(computeBodyHash(bufferFromRequestB))
    })

    it('produces a different hash when the underlying JSON payload differs', () => {
      // Arrange
      const bufferA = gzipSync(Buffer.from(JSON.stringify({ page: 'home' })))
      const bufferB = gzipSync(Buffer.from(JSON.stringify({ page: 'checkout' })))

      // Act & Assert
      expect(computeBodyHash(bufferA)).not.toBe(computeBodyHash(bufferB))
    })
  })

  describe('error recovery with random bytes fallback', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('uses randomBytes fallback when JSON.stringify fails completely', () => {
      // Arrange
      const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>
      const mockBuffer = Buffer.from('abc123def456789012345678')
      mockRandomBytes.mockReturnValue(mockBuffer)
      const onSerializeError = jest.fn()

      const circularRef: Record<string, any> = { name: 'test' }
      circularRef.self = circularRef

      // Act
      const result = computeBodyHash(circularRef, onSerializeError)

      // Assert
      expect(mockRandomBytes).toHaveBeenCalledWith(16)
      expect(result).toBe('abc123def456789012345678')
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('returns a valid hex string from randomBytes fallback', () => {
      // Arrange
      const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>
      const randomData = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99])
      mockRandomBytes.mockReturnValue(randomData)

      const circularRef: Record<string, any> = {}
      circularRef.self = circularRef

      // Act
      const result = computeBodyHash(circularRef)

      // Assert
      expect(result).toBe('aabbccddeeff00112233445566778899')
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('calls onSerializeError once when falling back to randomBytes', () => {
      // Arrange
      jest.mocked(randomBytes).mockReturnValue(Buffer.alloc(16, 0))
      const onSerializeError = jest.fn()
      const circularRef: Record<string, any> = {}
      circularRef.self = circularRef

      // Act
      computeBodyHash(circularRef, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('produces different hashes on repeated calls when randomBytes generates different values', () => {
      // Arrange
      const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>
      const mockBuffer1 = Buffer.from('abc123def456789012345678')
      const mockBuffer2 = Buffer.from('def456789012345678abc123')
      mockRandomBytes.mockReturnValueOnce(mockBuffer1).mockReturnValueOnce(mockBuffer2)

      const circularRef1: Record<string, any> = { a: 1 }
      circularRef1.self = circularRef1

      const circularRef2: Record<string, any> = { b: 2 }
      circularRef2.self = circularRef2

      // Act
      const result1 = computeBodyHash(circularRef1)
      const result2 = computeBodyHash(circularRef2)

      // Assert
      expect(result1).not.toBe(result2)
    })
  })

  describe('edge cases and boundary conditions', () => {
    it('handles very large nested object structures', () => {
      // Arrange
      const data: Record<string, any> = {}
      let current = data
      for (let i = 0; i < 100; i++) {
        current[`key${i}`] = {}
        current = current[`key${i}`]
      }
      current.value = 'deep'

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles objects with many properties', () => {
      // Arrange
      const data: Record<string, any> = {}
      for (let i = 0; i < 1000; i++) {
        data[`prop${i}`] = i
      }

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^[a-f0-9]{32}$/)
    })

    it('handles mixed array and object structures', () => {
      // Arrange
      const data = {
        arr: [{ a: 1 }, { b: 2 }],
        obj: { nested: [1, 2, 3] },
        val: 'string',
      }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles strings with special characters', () => {
      // Arrange
      const data = { text: 'Hello\nWorld\t\r\n"quoted"\\backslash' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles unicode strings', () => {
      // Arrange
      const data = { text: '😀🎉 こんにちは 🌍' }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles very large numeric values', () => {
      // Arrange
      const data = { big: Number.MAX_SAFE_INTEGER, small: Number.MIN_SAFE_INTEGER }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles floating point numbers', () => {
      // Arrange
      const data = { pi: Math.PI, e: Math.E, nan: NaN, inf: Infinity }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles negative zero', () => {
      // Arrange
      const data = { negZero: -0 }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles dates (which are objects)', () => {
      // Arrange
      const date = new Date('2024-01-01')
      const data = { date }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles regex objects (which are objects)', () => {
      // Arrange
      const regex = /test/gi
      const data = { regex }
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles objects with null prototype', () => {
      // Arrange
      const data = Object.create(null)
      data.a = 1
      data.b = 2
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })

    it('handles frozen objects', () => {
      // Arrange
      const data = Object.freeze({ a: 1, b: 2 })
      const expected = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')

      // Act
      const result = computeBodyHash(data)

      // Assert
      expect(result).toBe(expected)
    })
  })

  describe('deterministic ordering', () => {
    it('always produces the same output regardless of object property insertion order', () => {
      // Arrange
      const obj1: Record<string, any> = {}
      obj1.z = 1
      obj1.y = 2
      obj1.x = 3
      obj1.w = 4

      const obj2: Record<string, any> = {}
      obj2.w = 4
      obj2.x = 3
      obj2.y = 2
      obj2.z = 1

      // Act
      const hash1 = computeBodyHash(obj1)
      const hash2 = computeBodyHash(obj2)

      // Assert
      expect(hash1).toBe(hash2)
    })

    it('produces deterministic hash for nested objects regardless of insertion order', () => {
      // Arrange
      const obj1 = {
        outer: {
          z: { d: 1, c: 2, b: 3, a: 4 },
          a: { d: 1, c: 2, b: 3, a: 4 },
        },
      }

      const obj2 = {
        outer: {
          a: { a: 4, b: 3, c: 2, d: 1 },
          z: { a: 4, b: 3, c: 2, d: 1 },
        },
      }

      // Act
      const hash1 = computeBodyHash(obj1)
      const hash2 = computeBodyHash(obj2)

      // Assert
      expect(hash1).toBe(hash2)
    })
  })
})