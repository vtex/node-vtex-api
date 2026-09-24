import { MultilayeredCache } from './MultilayeredCache'
import { CacheLayer } from './CacheLayer'
import { FetchResult } from './typings'

describe('MultilayeredCache', () => {
  let mockCache1: jest.Mocked<CacheLayer<string, string>>
  let mockCache2: jest.Mocked<CacheLayer<string, string>>
  let mockCache3: jest.Mocked<CacheLayer<string, string>>
  let cache: MultilayeredCache<string, string>

  beforeEach(() => {
    mockCache1 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
    } as unknown as jest.Mocked<CacheLayer<string, string>>

    mockCache2 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
    } as unknown as jest.Mocked<CacheLayer<string, string>>

    mockCache3 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
    } as unknown as jest.Mocked<CacheLayer<string, string>>
  })

  describe('constructor', () => {
    it('should initialize with empty cache array', () => {
      // Arrange & Act
      const multilayeredCache = new MultilayeredCache([])

      // Assert
      expect(multilayeredCache).toBeDefined()
    })

    it('should initialize with multiple cache layers', () => {
      // Arrange & Act
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])

      // Assert
      expect(multilayeredCache).toBeDefined()
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return value from first cache layer when key exists', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.get.mockResolvedValue(value)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await cache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache1.get).toHaveBeenCalledWith(key)
      expect(mockCache2.has).not.toHaveBeenCalled()
    })

    it('should skip first cache and get value from second layer when key not in first', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(value)
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result = await cache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should populate skipped caches when value found in deeper layer', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(value)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      const key = 'testKey'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache3.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.get(key)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should fetch value when key not found but fetcher provided', async () => {
      // Arrange
      const key = 'testKey'
      const fetchedValue = 'fetchedValue'
      const fetchResult: FetchResult<string> = { value: fetchedValue, maxAge: 3600 }
      const fetcher = jest.fn().mockResolvedValue(fetchResult)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await cache.get(key, fetcher)

      // Assert
      expect(result).toBe(fetchedValue)
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith(key, fetchedValue, 3600)
      expect(mockCache2.set).toHaveBeenCalledWith(key, fetchedValue, 3600)
      expect(mockCache3.set).toHaveBeenCalledWith(key, fetchedValue, 3600)
    })

    it('should pass maxAge from fetched result to set operations', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      const maxAge = 7200
      const fetcher = jest.fn().mockResolvedValue({ value, maxAge })
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.set.mockResolvedValue(true)

      // Act
      await cache.get(key, fetcher)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should handle empty cache array gracefully', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])
      const key = 'testKey'
      const fetchedValue = 'fetchedValue'
      const fetcher = jest.fn().mockResolvedValue({ value: fetchedValue })

      // Act
      const result = await emptyCache.get(key, fetcher)

      // Assert
      expect(result).toBe(fetchedValue)
    })

    it('should return value when first cache has key but returns undefined value', async () => {
      // Arrange
      const key = 'testKey'
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(mockCache2.has).not.toHaveBeenCalled()
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should set value in all cache layers', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await cache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should set value with maxAge in all cache layers', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      const maxAge = 5000
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await cache.set(key, value, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return true if any cache layer successfully sets value', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await cache.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all cache layers fail to set value', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await cache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])
      const key = 'testKey'
      const value = 'testValue'

      // Act
      const result = await emptyCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return true if key exists in first cache layer', async () => {
      // Arrange
      const key = 'testKey'
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true if key exists in any cache layer', async () => {
      // Arrange
      const key = 'testKey'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if key does not exist in any cache layer', async () => {
      // Arrange
      const key = 'testKey'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has(key)

      // Assert
      expect(result).toBe(false)
    })

    it('should check all cache layers', async () => {
      // Arrange
      const key = 'testKey'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      await cache.has(key)

      // Assert
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
      expect(mockCache3.has).toHaveBeenCalledWith(key)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])
      const key = 'testKey'

      // Act
      const result = await emptyCache.has(key)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key1')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
      expect(stats.hitRate).toBe(1)
    })

    it('should return stats with custom name', async () => {
      // Arrange
      const customName = 'my-cache'
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key1')

      // Act
      const stats = cache.getStats(customName)

      // Assert
      expect(stats.name).toBe(customName)
    })

    it('should calculate hit rate correctly', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue('value2')
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      await cache.get('key1')
      await cache.get('key2')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is zero', async () => {
      // Arrange & Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should reset reported stats after getStats call', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key1')
      cache.getStats()

      // Act
      const secondStats = cache.getStats()

      // Assert
      expect(secondStats.hits).toBe(0)
      expect(secondStats.total).toBe(0)
      expect(secondStats.hitRate).toBeUndefined()
    })

    it('should return incremental stats between calls', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value')
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.set.mockResolvedValue(true)
      await cache.get('key1')
      const firstStats = cache.getStats()

      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key2')
      const secondStats = cache.getStats()

      // Assert
      expect(firstStats.hits).toBe(1)
      expect(firstStats.total).toBe(1)
      expect(secondStats.hits).toBe(1)
      expect(secondStats.total).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return cumulative hits and total', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key1')

      // Act
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.hits).toBe(1)
      expect(cumulativeStats.total).toBe(1)
    })

    it('should not reset cumulative stats', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value')
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.set.mockResolvedValue(true)
      await cache.get('key1')
      cache.getStats()

      // Act
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.hits).toBe(1)
      expect(cumulativeStats.total).toBe(1)
    })

    it('should accumulate stats across multiple operations', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue('value2')
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      await cache.get('key1')
      await cache.get('key2')
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.total).toBe(2)
      expect(cumulativeStats.hits).toBe(1)
    })

    it('should return zero stats initially', () => {
      // Arrange & Act
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.hits).toBe(0)
      expect(cumulativeStats.total).toBe(0)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should populate earlier cache layers when value found in later layer', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(value)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      const firstResult = await cache.get(key)
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue(value)
      const secondResult = await cache.get(key)

      // Assert
      expect(firstResult).toBe(value)
      expect(secondResult).toBe(value)
      expect(mockCache1.set).toHaveBeenCalled()
      expect(mockCache2.set).toHaveBeenCalled()
      expect(mockCache3.get).toHaveBeenCalledTimes(1)
    })

    it('should track stats correctly across get, set, and has operations', async () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(value)
      mockCache1.set.mockResolvedValue(true)
      mockCache1.has.mockResolvedValue(true)

      // Act
      await cache.get(key)
      await cache.set(key, value)
      await cache.has(key)
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(1)
    })
  })
})
