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

    it('should initialize with an empty array of caches', () => {
      // Arrange & Act
      multilayeredCache = new MultilayeredCache([])

      // Assert
      expect(multilayeredCache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with a single cache layer', () => {
      // Arrange & Act
      multilayeredCache = new MultilayeredCache([mockCache1])

      // Assert
      expect(multilayeredCache).toBeInstanceOf(MultilayeredCache)
    })
  })

  describe('get', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return value from first cache that has the key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce('cached-value')
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('cached-value')
      expect(mockCache1.get).toHaveBeenCalledWith('key1')
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
    })

    it('should return value from first cache without calling fetcher', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('first-cache-value')
      mockCache1.has.mockResolvedValueOnce(true)

      const fetcher = jest.fn()

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('first-cache-value')
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('should call fetcher when key is not found in any cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)

      const fetchResult: FetchResult<string> = { value: 'fetched-value', maxAge: 3600 }
      const fetcher = jest.fn().mockResolvedValueOnce(fetchResult)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalled()
    })

    it('should return undefined when key not found and no fetcher provided', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should populate all caches up to the one with the value', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce('value')
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.get('key1')

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value', undefined)
      expect(mockCache2.set).not.toHaveBeenCalled()
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should populate all caches with fetched value and maxAge', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)

      const fetchResult: FetchResult<string> = { value: 'fetched', maxAge: 5000 }
      const fetcher = jest.fn().mockResolvedValueOnce(fetchResult)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetched', 5000)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'fetched', 5000)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'fetched', 5000)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])
      const fetchResult: FetchResult<string> = { value: 'fetched', maxAge: 1000 }
      const fetcher = jest.fn().mockResolvedValueOnce(fetchResult)

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalled()
    })

    it('should increment hits when key is found', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.get('key1')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should increment total on each get call', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.total).toBe(2)
    })
  })

  describe('set', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should set value in all caches without maxAge', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'value1', undefined)
    })

    it('should set value in all caches with maxAge', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('key1', 'value1', 3600)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value1', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'value1', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'value1', 3600)
    })

    it('should return true if at least one cache returns true', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(false)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all caches return false', async () => {
      // Arrange
      mockCache1.set.mockResolvedValueOnce(false)
      mockCache2.set.mockResolvedValueOnce(false)
      mockCache3.set.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle single cache returning true', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1])
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return true if key exists in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if key does not exist in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should return true if key exists in first cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(true)
    })

    it('should check all caches for key existence', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      await multilayeredCache.has('key1')

      // Assert
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).toHaveBeenCalledWith('key1')
      expect(mockCache3.has).toHaveBeenCalledWith('key1')
    })

    it('should handle empty cache array', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should return true if at least one cache has the key', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('key1')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should return stats with custom name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      await multilayeredCache.get('key1')

      // Act
      const stats = multilayeredCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hitRate correctly', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)

      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')

      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is zero', async () => {
      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should reset reported stats after calling getStats', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      await multilayeredCache.get('key1')
      const stats1 = multilayeredCache.getStats()
      await multilayeredCache.get('key2')
      const stats2 = multilayeredCache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })

    it('should have zero hits and total initially', () => {
      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return cumulative hits and total', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)

      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should not reset cumulative stats after calling getCumulativeStats', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      await multilayeredCache.get('key1')
      const stats1 = multilayeredCache.getCumulativeStats()
      const stats2 = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(stats2.hits)
      expect(stats1.total).toBe(stats2.total)
    })

    it('should return zero for initial cumulative stats', () => {
      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should accumulate stats across multiple get calls', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)

      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      await multilayeredCache.get('key3')

      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should populate caches on miss and subsequent gets should hit first cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce('value')
      mockCache3.has.mockResolvedValueOnce(true)

      const fetchResult: FetchResult<string> = { value: 'value', maxAge: 1000 }
      const fetcher = jest.fn().mockResolvedValueOnce(fetchResult)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)

      // Act
      const result1 = await multilayeredCache.get('key1', fetcher)

      // Reset mocks for second call
      jest.clearAllMocks()
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      const result2 = await multilayeredCache.get('key1')

      // Assert
      expect(result1).toBe('value')
      expect(result2).toBe('value')
      expect(mockCache1.set).toHaveBeenCalled()
      expect(mockCache2.set).toHaveBeenCalled()
    })

    it('should handle multiple concurrent get operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value1')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache2.get.mockResolvedValueOnce('value2')
      mockCache2.has.mockResolvedValueOnce(true)

      // Act
      const [result1, result2] = await Promise.all([
        multilayeredCache.get('key1'),
        multilayeredCache.get('key2'),
      ])

      // Assert
      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
    })

    it('should track statistics correctly across multiple operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce('value')
      mockCache2.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      await multilayeredCache.get('key3')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
      expect(stats.hitRate).toBeCloseTo(0.667, 2)
    })
  })
})
