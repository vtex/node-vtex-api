import { MultilayeredCache } from './MultilayeredCache'
import { CacheLayer } from './CacheLayer'
import { FetchResult } from './typings'

describe('MultilayeredCache', () => {
  let mockCache1: jest.Mocked<CacheLayer<string, string>>
  let mockCache2: jest.Mocked<CacheLayer<string, string>>
  let mockCache3: jest.Mocked<CacheLayer<string, string>>
  let multilayeredCache: MultilayeredCache<string, string>

  beforeEach(() => {
    mockCache1 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      getStats: jest.fn(),
      getCumulativeStats: jest.fn(),
    } as any

    mockCache2 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      getStats: jest.fn(),
      getCumulativeStats: jest.fn(),
    } as any

    mockCache3 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      getStats: jest.fn(),
      getCumulativeStats: jest.fn(),
    } as any

    multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
  })

  describe('get', () => {
    it('should return value from first cache when key exists', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValue(value)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.get).toHaveBeenCalledWith(key)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.get).not.toHaveBeenCalled()
      expect(mockCache2.set).not.toHaveBeenCalled()
    })

    it('should return value from second cache when first cache misses', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(value)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.get).toHaveBeenCalledWith(key)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.get).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should populate earlier caches when value found in later cache', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(value)
      mockCache3.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should use fetcher when key not found in any cache', async () => {
      // Arrange
      const key = 'test-key'
      const fetchedValue = 'fetched-value'
      const fetchResult: FetchResult<string> = { value: fetchedValue, maxAge: 3600 }
      const fetcher = jest.fn().mockResolvedValue(fetchResult)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get(key, fetcher)

      // Assert
      expect(result).toBe(fetchedValue)
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith(key, fetchedValue, 3600)
      expect(mockCache2.set).toHaveBeenCalledWith(key, fetchedValue, 3600)
      expect(mockCache3.set).toHaveBeenCalledWith(key, fetchedValue, 3600)
    })

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(mockCache1.set).not.toHaveBeenCalled()
      expect(mockCache2.set).not.toHaveBeenCalled()
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should pass maxAge to fetched result to all caches', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'fetched-value'
      const maxAge = 7200
      const fetchResult: FetchResult<string> = { value, maxAge }
      const fetcher = jest.fn().mockResolvedValue(fetchResult)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      await multilayeredCache.get(key, fetcher)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should not call set on later caches when earlier cache provides value', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(value)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)

      // Act
      await multilayeredCache.get(key)

      // Assert
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should handle null values correctly', async () => {
      // Arrange
      const key = 'test-key'
      const value: any = null
      mockCache1.get.mockResolvedValue(value)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBeNull()
    })

    it('should handle void values correctly', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle single cache layer', async () => {
      // Arrange
      const singleCache = new MultilayeredCache([mockCache1])
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValue(value)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await singleCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.get).toHaveBeenCalledWith(key)
    })

    it('should increment total and hits counters on cache hit', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValue(value)
      mockCache1.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get(key)

      // Assert
      const stats = multilayeredCache.getCumulativeStats()
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(1)
    })

    it('should increment total but not hits counter on cache miss', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.get(key)

      // Assert
      const stats = multilayeredCache.getCumulativeStats()
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(0)
    })
  })

  describe('set', () => {
    it('should set value in all caches', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should set value with maxAge in all caches', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 3600
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.set(key, value, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return true when at least one cache sets successfully', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when all caches fail to set', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache<string, string>([])
      const key = 'test-key'
      const value = 'test-value'

      // Act
      const result = await emptyCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should handle single cache layer', async () => {
      // Arrange
      const singleCache = new MultilayeredCache([mockCache1])
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result = await singleCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
    })
  })

  describe('has', () => {
    it('should return true when key exists in first cache', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalled()
      expect(mockCache3.has).toHaveBeenCalled()
    })

    it('should return true when key exists in second cache', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when key exists in last cache', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when key does not exist in any cache', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true when multiple caches have the key', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache<string, string>([])
      const key = 'test-key'

      // Act
      const result = await emptyCache.has(key)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await multilayeredCache.get('key')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
      expect(stats.hitRate).toBe(1)
    })

    it('should return stats with custom name', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await multilayeredCache.get('key')

      // Act
      const stats = multilayeredCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hitRate correctly', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      mockCache2.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)

      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should return undefined hitRate when total is zero', async () => {
      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should reset reported stats after getStats call', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await multilayeredCache.get('key1')
      multilayeredCache.getStats()

      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)
      await multilayeredCache.get('key2')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
      expect(stats.hitRate).toBe(0)
    })

    it('should accumulate stats across multiple getStats calls', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await multilayeredCache.get('key1')
      const stats1 = multilayeredCache.getStats()

      await multilayeredCache.get('key2')

      // Act
      const stats2 = multilayeredCache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats with zero values initially', () => {
      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should return cumulative stats after get operations', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should return cumulative stats without resetting', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await multilayeredCache.get('key1')
      const stats1 = multilayeredCache.getCumulativeStats()

      await multilayeredCache.get('key2')

      // Act
      const stats2 = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(2)
      expect(stats2.total).toBe(2)
    })

    it('should return cumulative stats after getStats is called', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await multilayeredCache.get('key1')
      multilayeredCache.getStats()

      // Act
      const cumulativeStats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.hits).toBe(1)
      expect(cumulativeStats.total).toBe(1)
    })
  })

  describe('edge cases and integration', () => {
    it('should handle different value types', async () => {
      // Arrange
      const numberCache = new MultilayeredCache([mockCache1])
      const numberValue = 42
      mockCache1.get.mockResolvedValue(numberValue)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await numberCache.get('key')

      // Assert
      expect(result).toBe(numberValue)
    })

    it('should handle object values', async () => {
      // Arrange
      const objCache = new MultilayeredCache([mockCache1])
      const objValue = { nested: { value: 'test' } }
      mockCache1.get.mockResolvedValue(objValue)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await objCache.get('key')

      // Assert
      expect(result).toEqual(objValue)
    })

    it('should handle array values', async () => {
      // Arrange
      const arrCache = new MultilayeredCache([mockCache1])
      const arrValue = ['a', 'b', 'c']
      mockCache1.get.mockResolvedValue(arrValue)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await arrCache.get('key')

      // Assert
      expect(result).toEqual(arrValue)
    })

    it('should handle boolean values', async () => {
      // Arrange
      const boolCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValue(true)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await boolCache.get('key')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle zero value', async () => {
      // Arrange
      const zeroCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValue(0)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await zeroCache.get('key')

      // Assert
      expect(result).toBe(0)
    })

    it('should handle empty string value', async () => {
      // Arrange
      const emptyStrCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValue('')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await emptyStrCache.get('key')

      // Assert
      expect(result).toBe('')
    })

    it('should handle false boolean value', async () => {
      // Arrange
      const falseCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValue(false)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await falseCache.get('key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle Promise rejection in cache.get', async () => {
      // Arrange
      const error = new Error('Cache get failed')
      mockCache1.get.mockRejectedValue(error)
      mockCache1.has.mockResolvedValue(true)

      // Act & Assert
      await expect(multilayeredCache.get('key')).rejects.toThrow('Cache get failed')
    })

    it('should handle Promise rejection in cache.has', async () => {
      // Arrange
      const error = new Error('Cache has failed')
      mockCache1.has.mockRejectedValue(error)

      // Act & Assert
      await expect(multilayeredCache.get('key')).rejects.toThrow('Cache has failed')
    })

    it('should handle Promise rejection in cache.set for get operation', async () => {
      // Arrange
      const error = new Error('Cache set failed')
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value')
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockRejectedValue(error)

      // Act & Assert
      await expect(multilayeredCache.get('key')).rejects.toThrow('Cache set failed')
    })

    it('should handle Promise rejection in set operation', async () => {
      // Arrange
      const error = new Error('Cache set failed')
      mockCache1.set.mockRejectedValue(error)

      // Act & Assert
      await expect(multilayeredCache.set('key', 'value')).rejects.toThrow('Cache set failed')
    })

    it('should handle Promise rejection in has operation', async () => {
      // Arrange
      const error = new Error('Cache has failed')
      mockCache1.has.mockRejectedValue(error)

      // Act & Assert
      await expect(multilayeredCache.has('key')).rejects.toThrow('Cache has failed')
    })

    it('should handle fetcher rejection in get operation', async () => {
      // Arrange
      const error = new Error('Fetcher failed')
      const fetcher = jest.fn().mockRejectedValue(error)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act & Assert
      await expect(multilayeredCache.get('key', fetcher)).rejects.toThrow('Fetcher failed')
    })

    it('should work with many cache layers', async () => {
      // Arrange
      const manyMocks = Array.from({ length: 10 }, () => ({
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
      })) as any
      const manyCache = new MultilayeredCache(manyMocks)

      // Set all to miss except the 5th
      manyMocks.forEach((mock, index) => {
        if (index === 4) {
          mock.get.mockResolvedValue('found')
          mock.has.mockResolvedValue(true)
        } else {
          mock.get.mockResolvedValue(undefined)
          mock.has.mockResolvedValue(false)
          mock.set.mockResolvedValue(true)
        }
      })

      // Act
      const result = await manyCache.get('key')

      // Assert
      expect(result).toBe('found')
      // First 4 caches should be updated
      manyMocks.slice(0, 4).forEach(mock => {
        expect(mock.set).toHaveBeenCalled()
      })
      // Last 5 caches should not be updated
      manyMocks.slice(5).forEach(mock => {
        expect(mock.set).not.toHaveBeenCalled()
      })
    })
  })
})
