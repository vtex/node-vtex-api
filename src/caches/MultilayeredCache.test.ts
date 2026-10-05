import { MultilayeredCache } from './MultilayeredCache'
import { CacheLayer } from './CacheLayer'
import { FetchResult, MultilayerStats, CumulativeStats } from './typings'

// Mock CacheLayer implementations
const createMockCache = (): jest.Mocked<CacheLayer<string, string>> => ({
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  getStats: jest.fn(),
  getCumulativeStats: jest.fn(),
})

describe('MultilayeredCache', () => {
  describe('constructor', () => {
    it('should initialize with an array of cache layers', () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      const caches = [mockCache1, mockCache2]

      // Act
      const multilayeredCache = new MultilayeredCache(caches)

      // Assert
      expect(multilayeredCache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with an empty array of caches', () => {
      // Arrange
      const caches: CacheLayer<string, string>[] = []

      // Act
      const multilayeredCache = new MultilayeredCache(caches)

      // Assert
      expect(multilayeredCache).toBeInstanceOf(MultilayeredCache)
    })
  })

  describe('get method', () => {
    it('should return value from first cache layer when key exists', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.get.mockResolvedValue('value-from-cache1')
      mockCache1.has.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('value-from-cache1')
      expect(mockCache1.get).toHaveBeenCalledWith('test-key')
      expect(mockCache1.has).toHaveBeenCalledWith('test-key')
    })

    it('should return value from second cache layer when key not in first', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value-from-cache2')
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('value-from-cache2')
      expect(mockCache2.has).toHaveBeenCalledWith('test-key')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'value-from-cache2', undefined)
    })

    it('should populate earlier cache layers when value found in later layer', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      const mockCache3 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue('value-from-cache3')
      mockCache3.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('value-from-cache3')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'value-from-cache3', undefined)
      expect(mockCache2.set).toHaveBeenCalled()
    })

    it('should call fetcher when key not found in any cache', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched-value', maxAge: 3600 })
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.get('test-key', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'fetched-value', 3600)
    })

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched-value', maxAge: undefined })
      const multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.get('test-key', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalled()
    })

    it('should return undefined from cache when get returns undefined', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle fetcher with no maxAge', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched-value' })
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const result = await multilayeredCache.get('test-key', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'fetched-value', undefined)
    })

    it('should handle null value from cache', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.get.mockResolvedValue(null as any)
      mockCache1.has.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('set method', () => {
    it('should set value in all cache layers', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
    })

    it('should set value with maxAge in all cache layers', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value', 3600)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'test-value', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'test-value', 3600)
    })

    it('should return true if at least one cache layer sets successfully', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all cache layers fail to set', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache array on set', async () => {
      // Arrange
      const multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle setting null value', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.set.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const result = await multilayeredCache.set('test-key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', null, undefined)
    })
  })

  describe('has method', () => {
    it('should return true if key exists in any cache layer', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if key does not exist in any cache layer', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should return true if key exists in first cache layer', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      mockCache1.has.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockCache2.has).toHaveBeenCalled()
    })

    it('should handle empty cache array on has', async () => {
      // Arrange
      const multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should check all cache layers', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const mockCache2 = createMockCache()
      const mockCache3 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith('test-key')
      expect(mockCache2.has).toHaveBeenCalledWith('test-key')
      expect(mockCache3.has).toHaveBeenCalledWith('test-key')
    })
  })

  describe('getStats method', () => {
    it('should return stats with default name', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      mockCache1.has.mockResolvedValue(false)
      const multilayeredCache = new MultilayeredCache([mockCache1])
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats.total).toBeGreaterThanOrEqual(0)
      expect(stats.hits).toBeGreaterThanOrEqual(0)
      expect(typeof stats.hitRate).toBe('number' || 'undefined')
    })

    it('should return stats with custom name', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const stats = multilayeredCache.getStats('custom-cache-name')

      // Assert
      expect(stats.name).toBe('custom-cache-name')
    })

    it('should return hitRate as undefined when total is 0', () => {
      // Arrange
      const mockCache1 = createMockCache()
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return hitRate calculated from windowed counters', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1])
      await multilayeredCache.get('key1')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.total).toBeGreaterThan(0)
      expect(stats.hits).toBeGreaterThanOrEqual(0)
      if (stats.total > 0) {
        expect(stats.hitRate).toBe(stats.hits / stats.total)
      }
    })

    it('should include hits and total in stats', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      const multilayeredCache = new MultilayeredCache([mockCache1])
      await multilayeredCache.get('key1')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('name')
      expect(stats).toHaveProperty('hitRate')
    })
  })

  describe('getCumulativeStats method', () => {
    it('should return cumulative stats with hits, misses, and total', () => {
      // Arrange
      const mockCache1 = createMockCache()
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('total')
    })

    it('should return stats with numeric values', () => {
      // Arrange
      const mockCache1 = createMockCache()
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(typeof stats.hits).toBe('number')
      expect(typeof stats.misses).toBe('number')
      expect(typeof stats.total).toBe('number')
    })

    it('should track hits and misses across operations', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      const multilayeredCache = new MultilayeredCache([mockCache1])
      await multilayeredCache.get('key1')

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBeGreaterThan(0)
    })

    it('should accumulate stats across multiple get operations', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(false)
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      const stats1 = multilayeredCache.getCumulativeStats()
      await multilayeredCache.get('key3')
      const stats2 = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats2.total).toBeGreaterThanOrEqual(stats1.total)
    })
  })

  describe('edge cases and integration', () => {
    it('should handle multiple concurrent get operations', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('test-value')
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const results = await Promise.all([
        multilayeredCache.get('key1'),
        multilayeredCache.get('key2'),
        multilayeredCache.get('key3'),
      ])

      // Assert
      expect(results).toEqual(['test-value', 'test-value', 'test-value'])
    })

    it('should handle multiple concurrent set operations', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.set.mockResolvedValue(true)
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const results = await Promise.all([
        multilayeredCache.set('key1', 'value1'),
        multilayeredCache.set('key2', 'value2'),
        multilayeredCache.set('key3', 'value3'),
      ])

      // Assert
      expect(results).toEqual([true, true, true])
    })

    it('should handle mixed operations', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.set.mockResolvedValue(true)
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('test-value')
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      await multilayeredCache.set('key1', 'value1')
      const has = await multilayeredCache.has('key1')
      const get = await multilayeredCache.get('key1')

      // Assert
      expect(has).toBe(true)
      expect(get).toBe('test-value')
    })

    it('should handle single cache layer correctly', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('test-value')
      const multilayeredCache = new MultilayeredCache([mockCache1])

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('test-value')
      expect(mockCache1.get).toHaveBeenCalled()
    })

    it('should handle many cache layers', async () => {
      // Arrange
      const caches = Array.from({ length: 10 }, () => createMockCache())
      caches.forEach((cache, index) => {
        cache.has.mockResolvedValue(index === 9)
        if (index === 9) {
          cache.get.mockResolvedValue('value-from-layer-10')
        }
      })
      caches.slice(0, 9).forEach(cache => {
        cache.set.mockResolvedValue(true)
      })
      const multilayeredCache = new MultilayeredCache(caches)

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('value-from-layer-10')
      caches.slice(0, 9).forEach(cache => {
        expect(cache.set).toHaveBeenCalled()
      })
    })

    it('should handle special characters in keys', async () => {
      // Arrange
      const mockCache1 = createMockCache()
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('test-value')
      const multilayeredCache = new MultilayeredCache([mockCache1])
      const specialKey = 'key-with-!@#$%^&*()_+'

      // Act
      const result = await multilayeredCache.get(specialKey)

      // Assert
      expect(result).toBe('test-value')
      expect(mockCache1.get).toHaveBeenCalledWith(specialKey)
    })
  })
})
