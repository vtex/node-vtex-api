import { MultilayeredCache } from './MultilayeredCache'
import { CacheLayer, FetchResult } from './typings'

// Mock CacheLayer implementations
const createMockCacheLayer = (): jest.Mocked<CacheLayer<any, any>> => ({
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  getStats: jest.fn(),
  getCumulativeStats: jest.fn(),
})

describe('MultilayeredCache', () => {
  describe('constructor', () => {
    it('should initialize with an empty cache array', () => {
      // Arrange & Act
      const cache = new MultilayeredCache([])

      // Assert
      expect(cache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with multiple cache layers', () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()

      // Act
      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Assert
      expect(cache).toBeInstanceOf(MultilayeredCache)
    })
  })

  describe('get', () => {
    it('should return value from first cache layer when found', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(false)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.get('key')

      // Assert
      expect(result).toBe('value1')
      expect(mockCache1.get).toHaveBeenCalledWith('key')
      expect(mockCache1.has).toHaveBeenCalledWith('key')
    })

    it('should return value from second cache layer when first does not have it', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.get('key')

      // Assert
      expect(result).toBe('value2')
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value2', undefined)
    })

    it('should populate earlier cache layers when value found in later layer', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      const mockCache3 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue('value3')
      mockCache3.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])

      // Act
      const result = await cache.get('key')

      // Assert
      expect(result).toBe('value3')
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value3', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key', 'value3', undefined)
    })

    it('should use fetcher when key not found in any cache', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      const fetcher = jest.fn(async () => ({ value: 'fetched', maxAge: 3600 }))
      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.get('key', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'fetched', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('key', 'fetched', 3600)
    })

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.get('key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle fetcher without maxAge', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)

      const fetcher = jest.fn(async () => ({ value: 'fetched' }))
      const cache = new MultilayeredCache([mockCache1])

      // Act
      const result = await cache.get('key', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'fetched', undefined)
    })

    it('should work with empty cache layers array', async () => {
      // Arrange
      const fetcher = jest.fn(async () => ({ value: 'fetched', maxAge: 100 }))
      const cache = new MultilayeredCache([])

      // Act
      const result = await cache.get('key', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalled()
    })

    it('should increment stats counters correctly', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])

      // Act
      await cache.get('key1')
      await cache.get('key2')

      // Assert
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should increment total counter even on miss', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)

      const cache = new MultilayeredCache([mockCache1])

      // Act
      await cache.get('key1')
      await cache.get('key2')

      // Assert
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(2)
    })
  })

  describe('set', () => {
    it('should set value in all cache layers', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key', 'value', undefined)
    })

    it('should set value with maxAge in all cache layers', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.set('key', 'value', 3600)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('key', 'value', 3600)
    })

    it('should return true if at least one cache layer succeeds', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all cache layers fail', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache layers array', async () => {
      // Arrange
      const cache = new MultilayeredCache([])

      // Act
      const result = await cache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle single cache layer', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])

      // Act
      const result = await cache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', undefined)
    })
  })

  describe('has', () => {
    it('should return true if key exists in any cache layer', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.has('key')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if key does not exist in any cache layer', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.has('key')

      // Assert
      expect(result).toBe(false)
    })

    it('should return true if first cache layer has key', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const result = await cache.has('key')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle empty cache layers array', async () => {
      // Arrange
      const cache = new MultilayeredCache([])

      // Act
      const result = await cache.has('key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle single cache layer', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])

      // Act
      const result = await cache.has('key')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith('key')
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])
      await cache.get('key')

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
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])
      await cache.get('key')

      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hitRate correctly', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache1.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])
      await cache.get('key1')
      await cache.get('key2')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is 0', async () => {
      // Arrange
      const cache = new MultilayeredCache([])

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should reset reported stats after calling getStats', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])
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

    it('should track multiple calls correctly', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])
      await cache.get('key1')
      await cache.get('key2')
      await cache.get('key3')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(3)
      expect(stats.hitRate).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats with zero initial values', () => {
      // Arrange
      const cache = new MultilayeredCache([])

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should return cumulative stats after get operations', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])
      await cache.get('key1')
      await cache.get('key2')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should not reset cumulative stats after call', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value')
      mockCache1.has.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])
      await cache.get('key1')

      // Act
      const stats1 = cache.getCumulativeStats()
      const stats2 = cache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats2.hits).toBe(1)
    })

    it('should track cumulative stats across multiple operations', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2])
      await cache.get('key1')
      await cache.get('key2')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })
  })

  describe('integration tests', () => {
    it('should handle complex scenario with multiple cache layers', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      const mockCache3 = createMockCacheLayer()

      // First get - cache miss on 1 and 2, hit on 3
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce('value')
      mockCache3.has.mockResolvedValueOnce(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Second get - cache hit on 1
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      const cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])

      // Act
      const result1 = await cache.get('key')
      const result2 = await cache.get('key')

      // Assert
      expect(result1).toBe('value')
      expect(result2).toBe('value')
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key', 'value', undefined)

      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should handle mixed hits and misses', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      mockCache1.get.mockResolvedValueOnce('value1')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache1.set.mockResolvedValue(true)

      const cache = new MultilayeredCache([mockCache1])

      // Act
      const result1 = await cache.get('key1')
      const result2 = await cache.get('key2')

      // Assert
      expect(result1).toBe('value1')
      expect(result2).toBeUndefined()

      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should correctly chain set and has operations', async () => {
      // Arrange
      const mockCache1 = createMockCacheLayer()
      const mockCache2 = createMockCacheLayer()
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(false)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)

      const cache = new MultilayeredCache([mockCache1, mockCache2])

      // Act
      const setResult = await cache.set('key', 'value')
      const hasResult = await cache.has('key')

      // Assert
      expect(setResult).toBe(true)
      expect(hasResult).toBe(true)
    })
  })
})
