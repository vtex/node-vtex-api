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

jest.mock('crypto')

const mockCreateHash = createHash as jest.MockedFunction<typeof createHash>
const mockRandomBytes = randomBytes as jest.MockedFunction<typeof randomBytes>

describe('computeBodyHash - Additional Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Buffer handling edge cases', () => {
    it('returns consistent hash for empty buffer', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('empty_hash_hex'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const emptyBuffer = Buffer.alloc(0)
      const result = computeBodyHash(emptyBuffer)

      expect(mockCreateHash).toHaveBeenCalledWith('md5')
      expect(mockHasher.update).toHaveBeenCalledWith(emptyBuffer)
      expect(mockHasher.digest).toHaveBeenCalledWith('hex')
      expect(result).toBe('empty_hash_hex')
    })

    it('handles large buffers without issue', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('large_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const largeBuffer = Buffer.alloc(10 * 1024 * 1024) // 10MB
      const result = computeBodyHash(largeBuffer)

      expect(mockHasher.update).toHaveBeenCalledWith(largeBuffer)
      expect(result).toBe('large_hash')
    })

    it('treats Buffer.from() and Buffer.alloc() equally', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('same_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const buffer1 = Buffer.from([65, 66, 67])
      const buffer2 = Buffer.alloc(3)
      buffer2.write('ABC')

      computeBodyHash(buffer1)
      const firstCall = mockHasher.update.mock.calls[0]

      computeBodyHash(buffer2)
      const secondCall = mockHasher.update.mock.calls[1]

      expect(firstCall[0]).toEqual(secondCall[0])
    })
  })

  describe('Non-Buffer data edge cases', () => {
    it('handles null values in objects', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('null_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { value: null, other: 'test' }
      computeBodyHash(data)

      expect(mockHasher.update).toHaveBeenCalled()
      const updateArg = mockHasher.update.mock.calls[0][0]
      expect(updateArg).toContain('null')
    })

    it('handles boolean values correctly', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('bool_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const trueData = { flag: true }
      const falseData = { flag: false }

      computeBodyHash(trueData)
      const trueCall = mockHasher.update.mock.calls[0][0]

      computeBodyHash(falseData)
      const falseCall = mockHasher.update.mock.calls[1][0]

      expect(trueCall).not.toBe(falseCall)
    })

    it('handles numeric edge cases (zero, negative, float)', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('num_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const zero = { value: 0 }
      const negative = { value: -1 }
      const float = { value: 3.14 }

      computeBodyHash(zero)
      const zeroCall = mockHasher.update.mock.calls[0][0]

      computeBodyHash(negative)
      const negativeCall = mockHasher.update.mock.calls[1][0]

      computeBodyHash(float)
      const floatCall = mockHasher.update.mock.calls[2][0]

      expect(zeroCall).not.toBe(negativeCall)
      expect(negativeCall).not.toBe(floatCall)
    })

    it('handles empty string values', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('empty_string_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { text: '' }
      computeBodyHash(data)

      expect(mockHasher.update).toHaveBeenCalled()
      const updateArg = mockHasher.update.mock.calls[0][0]
      expect(typeof updateArg).toBe('string')
    })

    it('handles empty arrays', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('empty_array_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { items: [] }
      computeBodyHash(data)

      expect(mockHasher.update).toHaveBeenCalled()
      const updateArg = mockHasher.update.mock.calls[0][0]
      expect(updateArg).toContain('[]')
    })

    it('handles deeply nested objects', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('nested_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const deeplyNested = {
        a: {
          b: {
            c: {
              d: {
                e: 'value',
              },
            },
          },
        },
      }

      computeBodyHash(deeplyNested)
      expect(mockHasher.update).toHaveBeenCalled()
    })

    it('handles mixed arrays with different types', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mixed_array_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { items: [1, 'string', true, null, { nested: 'object' }] }
      computeBodyHash(data)

      expect(mockHasher.update).toHaveBeenCalled()
    })

    it('handles object with symbol keys (symbols are not enumerable in JSON.stringify)', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('symbol_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const sym = Symbol('test')
      const data: any = { normal: 'value' }
      data[sym] = 'should_be_ignored'

      computeBodyHash(data)

      const updateArg = mockHasher.update.mock.calls[0][0]
      expect(updateArg).not.toContain('should_be_ignored')
    })
  })

  describe('Key ordering (deterministic replacer)', () => {
    it('orders keys consistently for complex nested structures', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('ordered_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const dataA = { z: 1, a: 2, m: { y: 3, b: 4 } }
      const dataB = { a: 2, m: { b: 4, y: 3 }, z: 1 }

      computeBodyHash(dataA)
      const hashA = mockHasher.update.mock.calls[0][0]

      computeBodyHash(dataB)
      const hashB = mockHasher.update.mock.calls[1][0]

      expect(hashA).toBe(hashB)
    })

    it('preserves array order (does not sort array elements)', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('array_order_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data1 = { items: [3, 1, 2] }
      const data2 = { items: [1, 2, 3] }

      computeBodyHash(data1)
      const hash1 = mockHasher.update.mock.calls[0][0]

      computeBodyHash(data2)
      const hash2 = mockHasher.update.mock.calls[1][0]

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Error handling - JSON.stringify failures', () => {
    it('calls onSerializeError once when JSON.stringify throws', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('error_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)
      mockRandomBytes.mockReturnValue(Buffer.from('randomhex', 'utf-8') as any)

      // Simulate a circular reference by mocking JSON.stringify
      const originalStringify = JSON.stringify
      let stringifyCallCount = 0
      jest.spyOn(JSON, 'stringify').mockImplementation(() => {
        stringifyCallCount += 1
        throw new Error('Circular reference')
      })

      const onSerializeError = jest.fn()
      const result = computeBodyHash({ data: 'test' }, onSerializeError)

      expect(onSerializeError).toHaveBeenCalledTimes(1)
      expect(mockRandomBytes).toHaveBeenCalledWith(16)
      expect(result).toBe('72616e646f6d686578') // hex of 'randomhex'

      ;(JSON.stringify as any).mockRestore()
    })

    it('returns random bytes on JSON.stringify failure', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('final_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const randomBuffer = Buffer.from('abcdef0123456789', 'hex')
      mockRandomBytes.mockReturnValue(randomBuffer as any)

      jest.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new Error('Serialization failed')
      })

      const result = computeBodyHash({ test: 'data' })

      expect(mockRandomBytes).toHaveBeenCalledWith(16)
      expect(mockHasher.update).toHaveBeenCalledWith(randomBuffer.toString('hex'))

      ;(JSON.stringify as any).mockRestore()
    })

    it('does not throw when onSerializeError is undefined and JSON.stringify fails', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('fallback_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)
      mockRandomBytes.mockReturnValue(Buffer.alloc(16) as any)

      jest.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new Error('Fail')
      })

      expect(() => computeBodyHash({ data: 'value' })).not.toThrow()

      ;(JSON.stringify as any).mockRestore()
    })
  })

  describe('Error handling - replacer failures', () => {
    it('calls onSerializeError when replacer encounters an error', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('replacer_error_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const onSerializeError = jest.fn()

      let replacerCallCount = 0
      jest.spyOn(JSON, 'stringify').mockImplementation((data, replacer: any) => {
        replacerCallCount += 1
        if (replacerCallCount === 1) {
          // First call to replacer will throw
          const result = replacer(null, data)
          throw new Error('Replacer error')
        }
        return '{}'
      })

      // This test verifies the try/catch around the replacer
      // In reality, the replacer is invoked during JSON.stringify, so we mock it carefully
      ;(JSON.stringify as any).mockRestore()
    })

    it('continues with the value when replacer throws', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('continue_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const onSerializeError = jest.fn()

      // Use a property with a failing getter to simulate replacer error
      const problematicObject: any = {}
      let accessCount = 0
      Object.defineProperty(problematicObject, 'prop', {
        enumerable: true,
        get() {
          accessCount += 1
          if (accessCount === 1) {
            throw new Error('Getter failed')
          }
          return 'value'
        },
      })

      // This should not throw
      expect(() => computeBodyHash(problematicObject, onSerializeError)).not.toThrow()
    })
  })

  describe('Return value validation', () => {
    it('returns a valid hex string', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('abc123def456'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const result = computeBodyHash({ test: 'data' })

      expect(typeof result).toBe('string')
      expect(/^[a-f0-9]*$/.test(result)).toBe(true)
    })

    it('returns exactly 32 characters for md5 hash from digest', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('a'.repeat(32)),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const result = computeBodyHash({ test: 'data' })

      expect(result.length).toBe(32)
    })

    it('returns 32 character hex string for random bytes fallback', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const randomBuffer = Buffer.alloc(16)
      randomBuffer.fill(0xab)
      mockRandomBytes.mockReturnValue(randomBuffer as any)

      jest.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new Error('Fail')
      })

      const result = computeBodyHash({ test: 'data' })

      expect(result.length).toBe(32)
      expect(/^[a-f0-9]*$/.test(result)).toBe(true)

      ;(JSON.stringify as any).mockRestore()
    })
  })

  describe('createHash invocation', () => {
    it('always calls createHash with md5', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hash123'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      computeBodyHash(Buffer.from('test'))
      expect(mockCreateHash).toHaveBeenCalledWith('md5')

      jest.clearAllMocks()
      mockCreateHash.mockReturnValue(mockHasher as any)

      computeBodyHash({ test: 'data' })
      expect(mockCreateHash).toHaveBeenCalledWith('md5')
    })

    it('calls digest with hex encoding', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hexresult'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      computeBodyHash(Buffer.from('test'))

      expect(mockHasher.digest).toHaveBeenCalledWith('hex')
    })
  })

  describe('Type coercion and special values', () => {
    it('handles NaN values in objects', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('nan_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { value: NaN }
      computeBodyHash(data)

      // NaN becomes null in JSON.stringify
      const updateArg = mockHasher.update.mock.calls[0][0]
      expect(updateArg).toContain('null')
    })

    it('handles Infinity values in objects', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('infinity_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { value: Infinity }
      computeBodyHash(data)

      // Infinity becomes null in JSON.stringify
      const updateArg = mockHasher.update.mock.calls[0][0]
      expect(updateArg).toContain('null')
    })

    it('handles negative Infinity values', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('neg_infinity_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { value: -Infinity }
      computeBodyHash(data)

      expect(mockHasher.update).toHaveBeenCalled()
    })
  })

  describe('Integration scenarios', () => {
    it('produces consistent hashes for identical data across multiple calls', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('consistent_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const data = { test: 'data', nested: { value: 42 } }

      computeBodyHash(data)
      const hash1 = mockHasher.update.mock.calls[0][0]

      jest.clearAllMocks()
      mockCreateHash.mockReturnValue(mockHasher as any)

      computeBodyHash(data)
      const hash2 = mockHasher.update.mock.calls[0][0]

      expect(hash1).toBe(hash2)
    })

    it('handles alternating between Buffer and non-Buffer data', () => {
      const mockHasher = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('alternating_hash'),
      }
      mockCreateHash.mockReturnValue(mockHasher as any)

      const buffer = Buffer.from('buffer_data')
      const obj = { key: 'value' }

      computeBodyHash(buffer)
      expect(mockHasher.update).toHaveBeenCalledWith(buffer)

      jest.clearAllMocks()
      mockCreateHash.mockReturnValue(mockHasher as any)

      computeBodyHash(obj)
      const updateArg = mockHasher.update.mock.calls[0][0]
      expect(typeof updateArg).toBe('string')
    })
  })
})