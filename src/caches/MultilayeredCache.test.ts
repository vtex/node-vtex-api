import { MultilayeredCache } from './MultilayeredCache'
import { CacheLayer } from './CacheLayer'

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
    } as any

    mockCache2 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
    } as any

    mockCache3 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
    } as any

    multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
  })

  describe('constructor', () => {
    it('should initialize with empty caches array', () => {
      // Arrange & Act
      const cache = new MultilayeredCache([])

      // Assert
      expect(cache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with multiple caches', () => {
      // Arrange & Act
      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Assert
      expect(cache).toBeInstanceOf(MultilayeredCache)
    })
  })

  describe('get', () => {
    it('should return value from first cache that has the key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('cached-value')
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('cached-value')
      expect(mockCache1.get).toHaveBeenCalledWith('test-key')
      expect(mockCache1.has).toHaveBeenCalledWith('test-key')
    })

    it('should skip first cache and return value from second cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce('value-from-cache2')
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('value-from-cache2')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'value-from-cache2', undefined)
    })

    it('should populate earlier caches when value found in later cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce('value-from-cache3')
      mockCache3.has.mockResolvedValueOnce(true)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBe('value-from-cache3')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'value-from-cache3', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'value-from-cache3', undefined)
    })

    it('should call fetcher when key not found in any cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      const fetcher = jest.fn().mockResolvedValueOnce({ value: 'fetched-value', maxAge: 3600 })

      // Act
      const result = await multilayeredCache.get('test-key', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'fetched-value', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'fetched-value', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('test-key', 'fetched-value', 3600)
    })

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle fetcher with no maxAge', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      const fetcher = jest.fn().mockResolvedValueOnce({ value: 'fetched-value' })

      // Act
      const result = await multilayeredCache.get('test-key', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'fetched-value', undefined)
    })

    it('should track hits in findIndex when key is found', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.get('test-key')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(1)
    })

    it('should track total in findIndex when key is not found', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      await multilayeredCache.get('test-key')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(0)
    })

    it('should work with empty caches array and return undefined', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])

      // Act
      const result = await emptyCache.get('test-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should work with empty caches array and call fetcher', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])
      const fetcher = jest.fn().mockResolvedValueOnce({ value: 'fetched-value' })

      // Act
      const result = await emptyCache.get('test-key', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  describe('set', () => {
    it('should set value in all caches', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
      expect(mockCache3.set).toHaveBeenCalledWith('test-key', 'test-value', undefined)
    })

    it('should set value with maxAge in all caches', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value', 3600)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', 'test-value', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('test-key', 'test-value', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('test-key', 'test-value', 3600)
    })

    it('should return true if any cache set succeeds', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(false)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all caches fail to set', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(false)
      mockCache2.set.mockResolvedValueOnce(false)
      mockCache3.set.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(false)
    })

    it('should work with empty caches array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])

      // Act
      const result = await emptyCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle null/undefined values', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)
      const cacheWithAny = new MultilayeredCache([mockCache1, mockCache2, mockCache3])

      // Act
      const result = await cacheWithAny.set('test-key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('test-key', null, undefined)
    })
  })

  describe('has', () => {
    it('should return true if any cache has the key', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if no cache has the key', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should return true if first cache has the key', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has('test-key')

      // Assert
      expect(result).toBe(true)
    })

    it('should work with empty caches array', async () => {
      // Arrange
      const emptyCache = new MultilayeredCache([])

      // Act
      const result = await emptyCache.has('test-key')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('test-key')

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
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('test-key')

      // Act
      const stats = multilayeredCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hitRate correctly', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)

      await multilayeredCache.get('test-key-1')
      await multilayeredCache.get('test-key-2')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should return undefined hitRate when total is 0', async () => {
      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should reset reported stats after getStats call', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('test-key')

      // Act
      const stats1 = multilayeredCache.getStats()
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('test-key')
      const stats2 = multilayeredCache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats2.hits).toBe(1)
    })

    it('should track multiple get calls correctly', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      await multilayeredCache.get('key3')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(3)
      expect(stats.hitRate).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('test-key')

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should not reset cumulative stats after getCumulativeStats call', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('test-key')

      // Act
      const stats1 = multilayeredCache.getCumulativeStats()
      const stats2 = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })

    it('should return 0 values initially', () => {
      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should accumulate stats from multiple operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)

      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('should handle cache returning null value', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(null)
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('test-key')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle cache with numeric values', async () => {
      // Arrange
      const numericCache = new MultilayeredCache<string, number>([
        { get: jest.fn().mockResolvedValue(42), has: jest.fn().mockResolvedValue(true), set: jest.fn() } as any,
      ])

      // Act
      const result = await numericCache.get('test-key')

      // Assert
      expect(result).toBe(42)
    })

    it('should handle cache with boolean values', async () => {
      // Arrange
      const boolCache = new MultilayeredCache<string, boolean>([
        { get: jest.fn().mockResolvedValue(false), has: jest.fn().mockResolvedValue(true), set: jest.fn() } as any,
      ])

      // Act
      const result = await boolCache.get('test-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle concurrent get operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)

      // Act
      const [result1, result2, result3] = await Promise.all([
        multilayeredCache.get('key1'),
        multilayeredCache.get('key2'),
        multilayeredCache.get('key3'),
      ])

      // Assert
      expect(result1).toBe('value1')
      expect(result2).toBe('value1')
      expect(result3).toBe('value1')
      const stats = multilayeredCache.getCumulativeStats()
      expect(stats.total).toBe(3)
    })

    it('should handle very large cache array', async () => {
      // Arrange
      const mocks = Array.from({ length: 100 }, () => ({
        get: jest.fn().mockResolvedValue(undefined),
        has: jest.fn().mockResolvedValue(false),
        set: jest.fn().mockResolvedValue(false),
      })) as any[]
      mocks[50].get.mockResolvedValue('found-at-50')
      mocks[50].has.mockResolvedValue(true)
      mocks.forEach((m, i) => {
        if (i < 50) m.set.mockResolvedValue(true)
      })

      const largeCache = new MultilayeredCache(mocks)

      // Act
      const result = await largeCache.get('test-key')

      // Assert
      expect(result).toBe('found-at-50')
    })
  })
})
