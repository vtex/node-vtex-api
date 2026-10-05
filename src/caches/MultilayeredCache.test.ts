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
  })

  describe('constructor', () => {
    it('should initialize with array of caches', () => {
      // Arrange & Act
      cache = new MultilayeredCache([mockCache1, mockCache2])

      // Assert
      expect(cache).toBeDefined()
    })

    it('should initialize with empty array of caches', () => {
      // Arrange & Act
      cache = new MultilayeredCache([])

      // Assert
      expect(cache).toBeDefined()
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return value from first cache when key exists', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('cached-value')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.get('key1')

      // Assert
      expect(result).toBe('cached-value')
      expect(mockCache1.get).toHaveBeenCalledWith('key1')
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
    })

    it('should skip first cache and return from second cache when first missing', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value-from-cache2')
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.get('key1')

      // Assert
      expect(result).toBe('value-from-cache2')
      expect(mockCache1.get).toHaveBeenCalledWith('key1')
      expect(mockCache2.get).toHaveBeenCalledWith('key1')
    })

    it('should call fetcher when key not found in any cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetched-value',
        maxAge: 3600,
      })

      // Act
      const result = await cache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
      expect(fetcher).toHaveBeenCalled()
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
      const result = await cache.get('key1')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should populate failed caches with fetched value', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue('found-in-cache3')
      mockCache3.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      await cache.get('key1')

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'found-in-cache3', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'found-in-cache3', undefined)
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should populate all caches with fetched value when not found', async () => {
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
        maxAge: 7200,
      })

      // Act
      await cache.get('key1', fetcher)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetched-value', 7200)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'fetched-value', 7200)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'fetched-value', 7200)
    })

    it('should handle fetched value without maxAge', async () => {
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
      })

      // Act
      await cache.get('key1', fetcher)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetched-value', undefined)
    })

    it('should return value from first cache without calling other caches', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await cache.get('key1')

      // Assert
      expect(result).toBe('value1')
      expect(mockCache2.get).not.toHaveBeenCalled()
      expect(mockCache2.has).not.toHaveBeenCalled()
    })

    it('should handle empty caches array', async () => {
      // Arrange
      cache = new MultilayeredCache([])
      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetched-value',
        maxAge: 3600,
      })

      // Act
      const result = await cache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetched-value')
    })

    it('should await first set operation before returning', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('cached-value')
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      let setCalled = false
      mockCache1.set.mockImplementation(async () => {
        setCalled = true
        return true
      })

      // Act
      await cache.get('key1')

      // Assert
      expect(setCalled).toBe(true)
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should set value in all caches', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'value1', undefined)
    })

    it('should set value with maxAge', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      await cache.set('key1', 'value1', 3600)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value1', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'value1', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'value1', 3600)
    })

    it('should return true when at least one cache returns true', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when all caches return false', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty caches array', async () => {
      // Arrange
      cache = new MultilayeredCache([])

      // Act
      const result = await cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should set value with numeric value', async () => {
      // Arrange
      const numCache = new MultilayeredCache<string, number>([
        mockCache1 as any,
      ])
      ;(mockCache1.set as jest.Mock).mockResolvedValue(true)

      // Act
      await numCache.set('key1', 42)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 42, undefined)
    })

    it('should set value with object value', async () => {
      // Arrange
      const objValue = { id: 1, name: 'test' }
      const objCache = new MultilayeredCache<string, typeof objValue>([
        mockCache1 as any,
      ])
      ;(mockCache1.set as jest.Mock).mockResolvedValue(true)

      // Act
      await objCache.set('key1', objValue)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', objValue, undefined)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return true when key exists in first cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has('key1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when key exists in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has('key1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when key does not exist in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await cache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should check all caches in parallel', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(true)

      // Act
      await cache.has('key1')

      // Assert
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).toHaveBeenCalledWith('key1')
      expect(mockCache3.has).toHaveBeenCalledWith('key1')
    })

    it('should handle empty caches array', async () => {
      // Arrange
      cache = new MultilayeredCache([])

      // Act
      const result = await cache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should return true when at least one cache returns true', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(true)

      // Act
      const result = await cache.has('key1')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      await cache.get('key1')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toHaveProperty('name')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('total')
      expect(stats).toHaveProperty('hitRate')
      expect(stats.name).toBe('multilayred-cache')
    })

    it('should return stats with custom name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      await cache.get('key1')

      // Act
      const stats = cache.getStats('my-cache')

      // Assert
      expect(stats.name).toBe('my-cache')
    })

    it('should calculate hit rate correctly', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Perform multiple operations
      await cache.get('key1') // hit
      await cache.get('key2') // miss

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is zero', async () => {
      // Arrange - no operations performed

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return hitRate of 1 when all operations hit', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      await cache.get('key1')
      await cache.get('key2')
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return cumulative stats', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      await cache.get('key1')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('total')
      expect(typeof stats.hits).toBe('number')
      expect(typeof stats.total).toBe('number')
    })

    it('should track cumulative stats across multiple operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Act
      await cache.get('key1') // hit
      await cache.get('key2') // miss
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(1)
    })

    it('should return zero stats initially', async () => {
      // Arrange - new cache with no operations

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should populate L1 cache when value found in L2', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value-from-l2')
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)

      // Act
      const result = await cache.get('key1')

      // Assert
      expect(result).toBe('value-from-l2')
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value-from-l2', undefined)
      expect(mockCache2.set).not.toHaveBeenCalled()
    })

    it('should populate L1 and L2 when value found in L3', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue('value-from-l3')
      mockCache3.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      const result = await cache.get('key1')

      // Assert
      expect(result).toBe('value-from-l3')
      expect(mockCache1.set).toHaveBeenCalled()
      expect(mockCache2.set).toHaveBeenCalled()
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should handle multiple concurrent gets', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const results = await Promise.all([
        cache.get('key1'),
        cache.get('key2'),
        cache.get('key3'),
      ])

      // Assert
      expect(results).toEqual(['value1', 'value1', 'value1'])
    })

    it('should handle multiple concurrent sets', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const results = await Promise.all([
        cache.set('key1', 'value1'),
        cache.set('key2', 'value2'),
        cache.set('key3', 'value3'),
      ])

      // Assert
      expect(results).toEqual([true, true, true])
    })

    it('should handle single cache layer', async () => {
      // Arrange
      const singleCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await singleCache.get('key1')

      // Assert
      expect(result).toBe('value1')
    })

    it('should track stats across get and has operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)

      // Act
      await cache.get('key1')
      const stats1 = cache.getStats()
      await cache.has('key1')
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.total).toBeGreaterThan(0)
      expect(stats2.total).toBeGreaterThan(stats1.total)
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      cache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should handle cache.get rejection', async () => {
      // Arrange
      mockCache1.get.mockRejectedValue(new Error('Cache error'))
      mockCache1.has.mockResolvedValue(false)

      // Act & Assert
      await expect(cache.get('key1')).rejects.toThrow('Cache error')
    })

    it('should handle cache.has rejection', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockRejectedValue(new Error('Has error'))

      // Act & Assert
      await expect(cache.get('key1')).rejects.toThrow('Has error')
    })

    it('should handle fetcher rejection', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      const fetcher = jest.fn().mockRejectedValue(new Error('Fetch error'))

      // Act & Assert
      await expect(cache.get('key1', fetcher)).rejects.toThrow('Fetch error')
    })

    it('should handle set rejection in cache layer', async () => {
      // Arrange
      mockCache1.set.mockRejectedValue(new Error('Set error'))
      mockCache2.set.mockResolvedValue(true)

      // Act & Assert
      await expect(cache.set('key1', 'value1')).rejects.toThrow('Set error')
    })

    it('should handle has check rejection', async () => {
      // Arrange
      mockCache1.has.mockRejectedValue(new Error('Has check error'))

      // Act & Assert
      await expect(cache.has('key1')).rejects.toThrow('Has check error')
    })
  })
})
