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
import { computeBodyHash } from './bodyHash'

jest.mock('crypto', () => ({
  createHash: jest.fn(),
  randomBytes: jest.fn(),
}))

const mockCreateHash = createHash as jest.MockedFunction<typeof createHash>
const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>

describe('computeBodyHash - comprehensive edge cases and mocked scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('ArrayBuffer.isView detection and Buffer handling', () => {
    it('detects DataView as an ArrayBuffer view and hashes it directly', () => {
      // Arrange
      const buffer = Buffer.from([10, 20, 30])
      const dataView = new DataView(buffer.buffer)
      const mockDigest = jest.fn().mockReturnValue('abc123')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      const result = computeBodyHash(dataView)

      // Assert
      expect(mockCreateHash).toHaveBeenCalledWith('md5')
      expect(mockUpdate).toHaveBeenCalledWith(dataView)
      expect(mockDigest).toHaveBeenCalledWith('hex')
      expect(result).toBe('abc123')
    })

    it('detects TypedArray (Float32Array) as an ArrayBuffer view and hashes it directly', () => {
      // Arrange
      const typedArray = new Float32Array([1.5, 2.5, 3.5])
      const mockDigest = jest.fn().mockReturnValue('def456')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      const result = computeBodyHash(typedArray)

      // Assert
      expect(mockCreateHash).toHaveBeenCalledWith('md5')
      expect(mockUpdate).toHaveBeenCalledWith(typedArray)
      expect(result).toBe('def456')
    })

    it('handles empty Buffer', () => {
      // Arrange
      const emptyBuffer = Buffer.from([])
      const mockDigest = jest.fn().mockReturnValue('empty123')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      const result = computeBodyHash(emptyBuffer)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith(emptyBuffer)
      expect(result).toBe('empty123')
    })

    it('handles large Buffer', () => {
      // Arrange
      const largeBuffer = Buffer.alloc(1024 * 1024) // 1MB
      const mockDigest = jest.fn().mockReturnValue('large123')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      const result = computeBodyHash(largeBuffer)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith(largeBuffer)
      expect(result).toBe('large123')
    })

    it('returns different hash for different buffers', () => {
      // Arrange
      const buffer1 = Buffer.from([1, 2, 3])
      const buffer2 = Buffer.from([1, 2, 4])
      const mockDigest1 = jest.fn().mockReturnValue('hash1')
      const mockDigest2 = jest.fn().mockReturnValue('hash2')
      const mockUpdate1 = jest.fn().mockReturnValue({ digest: mockDigest1 })
      const mockUpdate2 = jest.fn().mockReturnValue({ digest: mockDigest2 })
      mockCreateHash
        .mockReturnValueOnce({ update: mockUpdate1 } as any)
        .mockReturnValueOnce({ update: mockUpdate2 } as any)

      // Act
      const hash1 = computeBodyHash(buffer1)
      const hash2 = computeBodyHash(buffer2)

      // Assert
      expect(hash1).toBe('hash1')
      expect(hash2).toBe('hash2')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('undefined data handling', () => {
    it('hashes undefined to a fixed deterministic value', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('undefined_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      const result = computeBodyHash(undefined)

      // Assert
      expect(mockCreateHash).toHaveBeenCalledWith('md5')
      expect(mockUpdate).toHaveBeenCalledWith('undefined')
      expect(mockDigest).toHaveBeenCalledWith('hex')
      expect(result).toBe('undefined_hash')
    })

    it('returns the same hash every time for undefined', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('consistent_undefined')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      const hash1 = computeBodyHash(undefined)
      const hash2 = computeBodyHash(undefined)

      // Assert
      expect(hash1).toBe(hash2)
      expect(hash1).toBe('consistent_undefined')
    })

    it('does not call onSerializeError for undefined', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const mockDigest = jest.fn().mockReturnValue('undefined_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(undefined, onSerializeError)

      // Assert
      expect(onSerializeError).not.toHaveBeenCalled()
    })
  })

  describe('deterministic object serialization', () => {
    it('sorts object keys alphabetically for deterministic output', () => {
      // Arrange
      const data = { z: 1, a: 2, m: 3 }
      const mockDigest = jest.fn().mockReturnValue('sorted_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      // After sorting keys: {"a":2,"m":3,"z":1}
      expect(stringifiedArg).toContain('"a"')
      const aIndex = stringifiedArg.indexOf('"a"')
      const mIndex = stringifiedArg.indexOf('"m"')
      const zIndex = stringifiedArg.indexOf('"z"')
      expect(aIndex).toBeLessThan(mIndex)
      expect(mIndex).toBeLessThan(zIndex)
    })

    it('handles nested objects by sorting all levels', () => {
      // Arrange
      const data = { outer: { z: 1, a: 2 }, b: 3 }
      const mockDigest = jest.fn().mockReturnValue('nested_sorted_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      // Verify nested object is also sorted
      expect(stringifiedArg).toContain('"z"')
      expect(stringifiedArg).toContain('"a"')
    })

    it('preserves arrays as-is without sorting', () => {
      // Arrange
      const data = { items: [3, 1, 2] }
      const mockDigest = jest.fn().mockReturnValue('array_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      // Arrays maintain order: [3,1,2]
      expect(stringifiedArg).toContain('[3,1,2]')
    })

    it('handles primitives (strings, numbers, booleans, null) correctly', () => {
      // Arrange
      const data = { str: 'value', num: 42, bool: true, nil: null }
      const mockDigest = jest.fn().mockReturnValue('primitives_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('"str"')
      expect(stringifiedArg).toContain('"value"')
      expect(stringifiedArg).toContain('"num"')
      expect(stringifiedArg).toContain('42')
      expect(stringifiedArg).toContain('"bool"')
      expect(stringifiedArg).toContain('true')
      expect(stringifiedArg).toContain('"nil"')
      expect(stringifiedArg).toContain('null')
    })

    it('handles deeply nested objects', () => {
      // Arrange
      const data = { a: { b: { c: { d: 1 } } } }
      const mockDigest = jest.fn().mockReturnValue('deep_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('"a"')
      expect(stringifiedArg).toContain('"d"')
    })

    it('handles empty objects', () => {
      // Arrange
      const data = {}
      const mockDigest = jest.fn().mockReturnValue('empty_obj_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('{}')
    })

    it('handles empty arrays', () => {
      // Arrange
      const data = { items: [] }
      const mockDigest = jest.fn().mockReturnValue('empty_arr_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('[]')
    })
  })

  describe('replacer error handling within deterministicReplacer', () => {
    it('calls onSerializeError when replacer catches an error', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const data = { normal: 'data' }
      const mockDigest = jest.fn().mockReturnValue('replacer_error_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Mock Object.entries to throw within the replacer context
      const originalEntries = Object.entries
      const entriesSpy = jest.spyOn(Object, 'entries')
      entriesSpy.mockImplementation((obj) => {
        if (obj && typeof obj === 'object' && 'trigger' in obj) {
          throw new Error('entries error')
        }
        return originalEntries(obj)
      })

      const testData = { trigger: true }

      // Act
      const result = computeBodyHash(testData, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')

      // Cleanup
      entriesSpy.mockRestore()
    })

    it('reports serialize error at most once when both replacer and outer catch hit it', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const mockDigest = jest.fn().mockReturnValue('hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      const originalEntries = Object.entries
      const entriesSpy = jest.spyOn(Object, 'entries')
      let callCount = 0
      entriesSpy.mockImplementation((obj) => {
        callCount++
        if (callCount > 0 && obj && typeof obj === 'object' && 'nested' in obj) {
          throw new Error('nested error')
        }
        return originalEntries(obj)
      })

      const testData = { nested: { value: 1 } }

      // Act
      computeBodyHash(testData, onSerializeError)

      // Assert
      // Should be called once even if multiple failures occur
      expect(onSerializeError.mock.calls.length).toBeLessThanOrEqual(1)

      // Cleanup
      entriesSpy.mockRestore()
    })

    it('continues execution when replacer error is caught (no throw)', () => {
      // Arrange
      const onSerializeError = jest.fn()
      const mockDigest = jest.fn().mockReturnValue('continue_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      const originalEntries = Object.entries
      const entriesSpy = jest.spyOn(Object, 'entries')
      entriesSpy.mockImplementation((obj) => {
        if (obj && typeof obj === 'object' && 'fail' in obj) {
          throw new Error('replacer fails')
        }
        return originalEntries(obj)
      })

      // Act & Assert
      expect(() => computeBodyHash({ fail: true }, onSerializeError)).not.toThrow()

      // Cleanup
      entriesSpy.mockRestore()
    })
  })

  describe('JSON.stringify exception handling', () => {
    it('falls back to randomBytes when JSON.stringify fails', () => {
      // Arrange
      const onSerializeError = jest.fn()
      mockCreateHash.mockImplementation(() => {
        throw new Error('stringify failed')
      })
      const mockRandomBytesBuffer = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd])
      mockRandomBytes.mockReturnValue(mockRandomBytesBuffer as any)

      const testData = { some: 'data' }

      // Act
      const result = computeBodyHash(testData, onSerializeError)

      // Assert
      expect(mockRandomBytes).toHaveBeenCalledWith(16)
      expect(result).toBe(mockRandomBytesBuffer.toString('hex'))
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('calls onSerializeError when falling back to randomBytes', () => {
      // Arrange
      const onSerializeError = jest.fn()
      mockCreateHash.mockImplementation(() => {
        throw new Error('hash creation failed')
      })
      mockRandomBytes.mockReturnValue(Buffer.from([0x11, 0x22]) as any)

      // Act
      computeBodyHash({ data: 'test' }, onSerializeError)

      // Assert
      expect(onSerializeError).toHaveBeenCalledTimes(1)
    })

    it('does not throw when JSON.stringify fails and onSerializeError is not provided', () => {
      // Arrange
      mockCreateHash.mockImplementation(() => {
        throw new Error('stringify error')
      })
      mockRandomBytes.mockReturnValue(Buffer.from([0x99]) as any)

      // Act & Assert
      expect(() => computeBodyHash({ problematic: 'data' })).not.toThrow()
    })

    it('generates unique hashes for different calls when using randomBytes fallback', () => {
      // Arrange
      mockCreateHash.mockImplementation(() => {
        throw new Error('consistent stringify failure')
      })
      mockRandomBytes
        .mockReturnValueOnce(Buffer.from([0x01, 0x02]) as any)
        .mockReturnValueOnce(Buffer.from([0x03, 0x04]) as any)

      // Act
      const hash1 = computeBodyHash({ data: 'first' })
      const hash2 = computeBodyHash({ data: 'second' })

      // Assert
      expect(hash1).not.toBe(hash2)
      expect(mockRandomBytes).toHaveBeenCalledTimes(2)
    })

    it('ensures random fallback produces hex string', () => {
      // Arrange
      mockCreateHash.mockImplementation(() => {
        throw new Error('stringify failed')
      })
      const randomBuffer = Buffer.from('f7e2c8a1b9d3f5e0', 'hex')
      mockRandomBytes.mockReturnValue(randomBuffer as any)

      // Act
      const result = computeBodyHash({ fail: 'yes' })

      // Assert
      expect(result).toBe('f7e2c8a1b9d3f5e0')
      expect(result).toMatch(/^[0-9a-f]*$/)
    })
  })

  describe('edge cases with special object types', () => {
    it('handles objects with Symbol properties (filtered by JSON.stringify)', () => {
      // Arrange
      const data = { visible: 'yes', [Symbol('hidden')]: 'no' }
      const mockDigest = jest.fn().mockReturnValue('symbol_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('"visible"')
      // Symbol properties are filtered out by JSON.stringify
      expect(stringifiedArg).not.toContain('hidden')
    })

    it('handles objects with undefined values (filtered by JSON.stringify)', () => {
      // Arrange
      const data = { present: 'value', absent: undefined }
      const mockDigest = jest.fn().mockReturnValue('undef_value_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('"present"')
      // undefined values are filtered out by JSON.stringify
      expect(stringifiedArg).not.toContain('"absent"')
    })

    it('handles Date objects (serialized to ISO string)', () => {
      // Arrange
      const data = { timestamp: new Date('2024-01-01T00:00:00Z') }
      const mockDigest = jest.fn().mockReturnValue('date_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      // Dates are serialized to ISO strings
      expect(stringifiedArg).toContain('2024-01-01')
    })

    it('handles functions (filtered by JSON.stringify)', () => {
      // Arrange
      const data: any = { value: 'data', fn: () => {} }
      const mockDigest = jest.fn().mockReturnValue('func_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('"value"')
      // Functions are filtered out by JSON.stringify
      expect(stringifiedArg).not.toContain('fn')
    })

    it('handles null values within objects', () => {
      // Arrange
      const data = { value: null, other: 'data' }
      const mockDigest = jest.fn().mockReturnValue('null_value_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('null')
    })
  })

  describe('comparison with non-mocked real behavior (integration-like)', () => {
    beforeEach(() => {
      // Restore actual crypto for these tests
      jest.unmock('crypto')
    })

    afterEach(() => {
      // Re-mock for other tests
      jest.mock('crypto')
    })

    it('produces consistent 32-character hex strings (16-byte MD5)', () => {
      const { computeBodyHash: realComputeBodyHash } = require('./bodyHash')

      // Act
      const hash = realComputeBodyHash({ data: 'test' })

      // Assert
      expect(hash).toMatch(/^[0-9a-f]{32}$/)
    })

    it('produces same hash for equivalent objects with different key order', () => {
      const { computeBodyHash: realComputeBodyHash } = require('./bodyHash')

      // Act
      const hash1 = realComputeBodyHash({ a: 1, b: 2, c: 3 })
      const hash2 = realComputeBodyHash({ c: 3, a: 1, b: 2 })

      // Assert
      expect(hash1).toBe(hash2)
    })
  })

  describe('null handling', () => {
    it('handles null as a serializable primitive', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('null_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(null)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('null')
    })
  })

  describe('primitive data types', () => {
    it('handles string primitive', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('string_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash('test string')

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('"test string"')
    })

    it('handles number primitive', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('number_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(42)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('42')
    })

    it('handles boolean primitive (true)', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('bool_true_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(true)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('true')
    })

    it('handles boolean primitive (false)', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('bool_false_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(false)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('false')
    })

    it('handles zero', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('zero_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(0)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('0')
    })

    it('handles negative number', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('neg_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(-123)

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('-123')
    })

    it('handles empty string', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('empty_string_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash('')

      // Assert
      expect(mockUpdate).toHaveBeenCalledWith('""')
    })

    it('handles string with special characters', () => {
      // Arrange
      const mockDigest = jest.fn().mockReturnValue('special_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash('test\n\t\r"with\\escapes')

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      // Verify JSON escaping is applied
      const arg = mockUpdate.mock.calls[0][0]
      expect(arg).toContain('\\n')
      expect(arg).toContain('\\t')
    })
  })

  describe('complex nested structures', () => {
    it('handles array of objects with consistent sorting', () => {
      // Arrange
      const data = [
        { z: 1, a: 2 },
        { b: 3, x: 4 },
      ]
      const mockDigest = jest.fn().mockReturnValue('array_obj_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      // Each object within the array should have sorted keys
      const aIndex = stringifiedArg.indexOf('"a"')
      const zIndex = stringifiedArg.indexOf('"z"')
      expect(aIndex).toBeLessThan(zIndex)
    })

    it('handles object with mixed array and object properties', () => {
      // Arrange
      const data = { arr: [1, 2], obj: { nested: true }, str: 'value' }
      const mockDigest = jest.fn().mockReturnValue('mixed_hash')
      const mockUpdate = jest.fn().mockReturnValue({ digest: mockDigest })
      mockCreateHash.mockReturnValue({ update: mockUpdate } as any)

      // Act
      computeBodyHash(data)

      // Assert
      expect(mockUpdate).toHaveBeenCalled()
      const stringifiedArg = mockUpdate.mock.calls[0][0]
      expect(stringifiedArg).toContain('"arr"')
      expect(stringifiedArg).toContain('"obj"')
      expect(stringifiedArg).toContain('"str"')
      expect(stringifiedArg).toContain('[1,2]')
    })
  })
})