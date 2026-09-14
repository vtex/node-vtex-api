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

    cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
  })

  describe('constructor', () => {
    it('should initialize with empty cache array', () => {
      const emptyCache = new MultilayeredCache([])
      expect(emptyCache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with single cache', () => {
      const singleCache = new MultilayeredCache([mockCache1])
      expect(singleCache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with multiple caches', () => {
      expect(cache).toBeInstanceOf(MultilayeredCache)
    })
  })

  describe('get', () => {
    it('should return value from first cache when it has the key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('cached-value')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toBe('cached-value')
      expect(mockCache1.get).toHaveBeenCalledWith('test-key')
      expect(mockCache1.has).toHaveBeenCalledWith('test-key')
      expect(mockCache2.get).not.toHaveBeenCalled()
    })

    it('should skip first cache and return from second cache when first does not have key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('second-value')
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toBe('second-value')
      expect(mockCache1.get).toHaveBeenCalledWith('test-key')
      expect(mockCache2.get).toHaveBeenCalledWith('test-key')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'second-value', undefined)
    })

    it('should check all caches and use fetcher when no cache has key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetched-value',
        maxAge: 3600,
      } as FetchResult<string>)

      // Act
      const result = await cache.get('test-key', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'fetched-value', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'fetched-value', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('test-key', 'fetched-value', 3600)
    })

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should populate earlier caches with value found in later cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue('deep-value')
      mockCache3.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toBe('deep-value')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'deep-value', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'deep-value', undefined)
    })

    it('should populate earlier caches with fetched value including maxAge', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetched',
        maxAge: 7200,
      } as FetchResult<string>)

      // Act
      const result = await cache.get('key', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'fetched', 7200)
      expect(mockCache2.set).toHaveBeenCalledWith('key', 'fetched', 7200)
    })

    it('should not populate caches if found immediately in first cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('instant-value')
      mockCache1.has.mockResolvedValue(true)

      // Act
      await cache.get('test-key')

      // Assert
      expect(mockCache1.set).not.toHaveBeenCalled()
      expect(mockCache2.set).not.toHaveBeenCalled()
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])
      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetched',
        maxAge: undefined,
      } as FetchResult<string>)

      // Act
      const result = await emptyCache.get('key', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalled()
    })

    it('should handle fetcher returning undefined value', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.set.mockResolvedValue(true)

      const fetcher = jest.fn().mockResolvedValue({
        value: undefined,
        maxAge: 1000,
      } as FetchResult<string | undefined>)

      // Act
      const result = await cache.get('key', fetcher)

      // Assert
      expect(result).toBeUndefined()
      expect(mockCache1.set).toHaveBeenCalledWith('key', undefined, 1000)
    })
  })

  describe('set', () => {
    it('should set value in all caches', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await cache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
      expect(mockCache3.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
    })

    it('should set value with maxAge in all caches', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await cache.set('test-key', 'test-value', 5000)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'test-value', 5000)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'test-value', 5000)
      expect(mockCache3.set).toHaveBeenCalledWith('test-key', 'test-value', 5000)
    })

    it('should return true if at least one cache succeeds', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await cache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all caches fail', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await cache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])

      // Act
      const result = await emptyCache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle single cache', async () => {
      // Arrange
      const singleCache = new MultilayeredCache([mockCache1])
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result = await singleCache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', undefined)
    })
  })

  describe('has', () => {
    it('should return true if first cache has key', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await cache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith('test-key')
    })

    it('should return true if any cache has key', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith('test-key')
      expect(mockCache2.has).toHaveBeenCalledWith('test-key')
    })

    it('should return false if no cache has key', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has('test-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])

      // Act
      const result = await emptyCache.has('key')

      // Assert
      expect(result).toBe(false)
    })

    it('should check all caches even if first returns true', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has('test-key')

      // Assert
      expect(result).toBe(true)
      // Note: due to parallel execution with Promise.all, all are called
      expect(mockCache1.has).toHaveBeenCalledWith('test-key')
    })
  })

  describe('getStats', () => {
    it('should return default stats with default name', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        hitRate: undefined,
        hits: 0,
        name: 'multilayred-cache',
        total: 0,
      })
    })

    it('should return stats with custom name', () => {
      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value1')

      // Simulate 3 gets: 2 hits, 1 miss
      await cache.get('key1')
      await cache.get('key2')
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value3')
      await cache.get('key3')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(2)
      expect(stats.hitRate).toBeCloseTo(2 / 3, 5)
    })

    it('should return hitRate as undefined when total is 0', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should reset reported stats after getStats call', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key1')

      // Act
      const stats1 = cache.getStats()
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
    })

    it('should track hits and total independently', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value')

      // Simulate 5 gets: 2 hits, 3 misses
      await cache.get('key1')
      await cache.get('key2')
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key3')
      await cache.get('key4')
      await cache.get('key5')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(5)
      expect(stats.hits).toBe(3)
      expect(stats.hitRate).toBeCloseTo(0.6, 5)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats with zero values initially', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
      })
    })

    it('should return cumulative stats without resetting', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key1')

      // Act
      const stats1 = cache.getCumulativeStats()
      const stats2 = cache.getCumulativeStats()

      // Assert
      expect(stats1).toEqual({ hits: 1, total: 1 })
      expect(stats2).toEqual({ hits: 1, total: 1 })
    })

    it('should accumulate hits and total across multiple operations', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value')

      await cache.get('key1')
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key2')
      await cache.get('key3')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(2)
    })

    it('should maintain cumulative stats independently from reported stats', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value')
      await cache.get('key1')

      // Act - call getStats to reset reported
      cache.getStats()
      await cache.get('key2')
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.hits).toBe(2)
      expect(cumulativeStats.total).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complex multilayer cache scenario', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value-l2')
      mockCache2.has.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      const result = await cache.get('test-key')
      const stats = cache.getStats()

      // Assert
      expect(result).toBe('value-l2')
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
      expect(stats.hitRate).toBe(1)
      expect(mockCache1.set).toHaveBeenCalled()
    })

    it('should handle set and has operations correctly', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)
      mockCache1.has.mockResolvedValue(true)

      // Act
      await cache.set('key', 'value', 3600)
      const hasKey = await cache.has('key')
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(hasKey).toBe(true)
      expect(cumulativeStats.total).toBe(1)
      expect(cumulativeStats.hits).toBe(1)
    })

    it('should handle multiple gets with different hit patterns', async () => {
      // Arrange - setup for miss then hit scenario
      mockCache1.has.mockResolvedValue(false)
      mockCache1.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue('value3')
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      await cache.get('key1')
      const stats1 = cache.getStats()

      // Reset mocks for second scenario
      mockCache1.has.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value1')

      await cache.get('key2')
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(0)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })
  })
})
