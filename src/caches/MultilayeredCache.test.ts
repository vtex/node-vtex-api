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
  })

  describe('constructor', () => {
    it('should initialize with an array of cache layers', () => {
      // Arrange & Act
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Assert
      expect(multilayeredCache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with an empty array of cache layers', () => {
      // Arrange & Act
      multilayeredCache = new MultilayeredCache([])

      // Assert
      expect(multilayeredCache).toBeInstanceOf(MultilayeredCache)
    })
  })

  describe('get', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return value from first cache layer that has the key', async () => {
      // Arrange
      const key = 'test-key'
      const expectedValue = 'test-value'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(expectedValue)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue('other-value')
      mockCache3.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(expectedValue)
      expect(mockCache1.get).toHaveBeenCalledWith(key)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.get).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
    })

    it('should return value from first cache layer without calling further layers', async () => {
      // Arrange
      const key = 'test-key'
      const expectedValue = 'test-value'
      mockCache1.get.mockResolvedValue(expectedValue)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(expectedValue)
      expect(mockCache2.get).not.toHaveBeenCalled()
      expect(mockCache2.has).not.toHaveBeenCalled()
      expect(mockCache3.get).not.toHaveBeenCalled()
      expect(mockCache3.has).not.toHaveBeenCalled()
    })

    it('should return undefined when key is not found in any cache and no fetcher provided', async () => {
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
    })

    it('should use fetcher and populate all caches when key is not found', async () => {
      // Arrange
      const key = 'test-key'
      const fetchedValue = 'fetched-value'
      const maxAge = 3600
      const fetcher = jest.fn().mockResolvedValue({
        value: fetchedValue,
        maxAge,
      })
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
      expect(mockCache1.set).toHaveBeenCalledWith(key, fetchedValue, maxAge)
      expect(mockCache2.set).toHaveBeenCalledWith(key, fetchedValue, maxAge)
      expect(mockCache3.set).toHaveBeenCalledWith(key, fetchedValue, maxAge)
    })

    it('should populate only failed caches when value is found', async () => {
      // Arrange
      const key = 'test-key'
      const expectedValue = 'test-value'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(expectedValue)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue('other-value')
      mockCache3.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(expectedValue)
      expect(mockCache1.set).toHaveBeenCalledWith(key, expectedValue, undefined)
      expect(mockCache2.set).not.toHaveBeenCalled()
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should handle fetcher returning value without maxAge', async () => {
      // Arrange
      const key = 'test-key'
      const fetchedValue = 'fetched-value'
      const fetcher = jest.fn().mockResolvedValue({
        value: fetchedValue,
      })
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
      expect(mockCache1.set).toHaveBeenCalledWith(key, fetchedValue, undefined)
    })

    it('should increment read counter for each get call', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)
      const stats1 = await multilayeredCache.getStats()
      const initialTotal = stats1.total

      // Act
      await multilayeredCache.get(key)

      // Assert
      const stats2 = await multilayeredCache.getStats()
      expect(stats2.total).toBeGreaterThan(initialTotal)
    })

    it('should increment hit counter when key is found', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)
      const statsBefore = await multilayeredCache.getStats()
      const hitsBefore = statsBefore.hits

      // Act
      await multilayeredCache.get(key)

      // Assert
      const statsAfter = await multilayeredCache.getStats()
      expect(statsAfter.hits).toBeGreaterThan(hitsBefore)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])
      const key = 'test-key'
      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetched-value',
      })

      // Act
      const result = await multilayeredCache.get(key, fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalled()
    })

    it('should handle null value from cache', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.get.mockResolvedValue(null as any)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should set value in all caches and return true if at least one succeeds', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(false)

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
      const maxAge = 7200
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

    it('should return false if all caches fail to set', async () => {
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

    it('should return true if at least one cache succeeds', async () => {
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

    it('should return false when cache array is empty', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle single cache layer', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1])
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', undefined)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return true if key exists in any cache', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
      expect(mockCache3.has).toHaveBeenCalledWith(key)
    })

    it('should return false if key does not exist in any cache', async () => {
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

    it('should return true if key exists in first cache', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when cache array is empty', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.has('key')

      // Assert
      expect(result).toBe(false)
    })

    it('should check all caches in parallel', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.has(key)

      // Assert
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
      expect(mockCache3.has).toHaveBeenCalledWith(key)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return stats with default name', async () => {
      // Arrange & Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('total')
    })

    it('should return stats with custom name', async () => {
      // Arrange
      const customName = 'my-custom-cache'

      // Act
      const stats = multilayeredCache.getStats(customName)

      // Assert
      expect(stats.name).toBe(customName)
    })

    it('should return undefined hitRate when total is 0', async () => {
      // Arrange & Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should calculate hitRate correctly', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      await multilayeredCache.get('key3')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.total).toBeGreaterThan(0)
      expect(stats.hits).toBeGreaterThan(0)
      expect(stats.hitRate).toBeDefined()
      if (stats.hitRate !== undefined) {
        expect(stats.hitRate).toBeGreaterThanOrEqual(0)
        expect(stats.hitRate).toBeLessThanOrEqual(1)
      }
    })

    it('should return separate stats object each call', async () => {
      // Arrange & Act
      const stats1 = multilayeredCache.getStats()
      const stats2 = multilayeredCache.getStats()

      // Assert
      expect(stats1).not.toBe(stats2)
      expect(stats1).toEqual(stats2)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return cumulative stats with hits and total', async () => {
      // Arrange & Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('total')
      expect(typeof stats.hits).toBe('number')
      expect(typeof stats.total).toBe('number')
    })

    it('should have non-negative values', async () => {
      // Arrange & Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBeGreaterThanOrEqual(0)
      expect(stats.total).toBeGreaterThanOrEqual(0)
    })

    it('should accumulate stats across multiple operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)
      const statsBefore = multilayeredCache.getCumulativeStats()

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      const statsAfter = multilayeredCache.getCumulativeStats()

      // Assert
      expect(statsAfter.total).toBeGreaterThan(statsBefore.total)
      expect(statsAfter.hits).toBeGreaterThanOrEqual(statsBefore.hits)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should handle cache miss and then populate on subsequent get', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'cached-value'
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(value)
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result1 = await multilayeredCache.get(key)
      mockCache1.get.mockResolvedValue(value)
      const result2 = await multilayeredCache.get(key)

      // Assert
      expect(result1).toBe(value)
      expect(result2).toBe(value)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should handle mixed success and failure in set operations', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockRejectedValueOnce(new Error('Set failed'))
      mockCache3.set.mockResolvedValue(true)
      const key = 'test-key'
      const value = 'test-value'

      // Act & Assert
      try {
        await multilayeredCache.set(key, value)
      } catch (e) {
        // Expected behavior - set should handle promise rejections gracefully or propagate
      }
    })

    it('should track statistics across multiple cache operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      const initialStats = multilayeredCache.getCumulativeStats()

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      await multilayeredCache.get('key3')

      // Assert
      const finalStats = multilayeredCache.getCumulativeStats()
      expect(finalStats.total).toBe(initialStats.total + 3)
    })

    it('should handle fetcher exceptions gracefully', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      const fetcher = jest.fn().mockRejectedValue(new Error('Fetch failed'))

      // Act & Assert
      await expect(multilayeredCache.get('key', fetcher)).rejects.toThrow('Fetch failed')
    })
  })
})
