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
  })

  describe('constructor', () => {
    it('should initialize with an array of cache layers', () => {
      // Arrange
      const caches = [mockCache1, mockCache2]

      // Act
      multilayeredCache = new MultilayeredCache(caches)

      // Assert
      expect(multilayeredCache).toBeDefined()
    })

    it('should initialize with an empty array of cache layers', () => {
      // Arrange
      const caches: CacheLayer<string, string>[] = []

      // Act
      multilayeredCache = new MultilayeredCache(caches)

      // Assert
      expect(multilayeredCache).toBeDefined()
    })
  })

  describe('get', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return value from first cache that has the key', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(value)
      mockCache2.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.get).toHaveBeenCalledWith(key)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.get).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
    })

    it('should return value from first cache layer', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.get.mockResolvedValueOnce(value)
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.get).toHaveBeenCalledWith(key)
      expect(mockCache2.get).not.toHaveBeenCalled()
    })

    it('should use fetcher when key not found in any cache', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'fetched-value'
      const maxAge = 3600
      const fetcher = jest.fn().mockResolvedValueOnce({
        value,
        maxAge,
      })
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get(key, fetcher)

      // Assert
      expect(result).toBe(value)
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return undefined when fetcher is not provided and key not found', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should populate failed caches with fetched value', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'fetched-value'
      const maxAge = 1800
      const fetcher = jest.fn().mockResolvedValueOnce({
        value,
        maxAge,
      })
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.get(key, fetcher)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should populate only earlier caches when value found in middle cache', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'cached-value'
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(value)
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.get(key)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache2.set).not.toHaveBeenCalled()
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should handle fetcher without maxAge', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'fetched-value'
      const fetcher = jest.fn().mockResolvedValueOnce({
        value,
      })
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(undefined)
      mockCache3.has.mockResolvedValueOnce(false)
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get(key, fetcher)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should return value from first cache even when not in consecutive order', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'value-from-cache3'
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.get.mockResolvedValueOnce(value)
      mockCache3.has.mockResolvedValueOnce(true)
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, undefined)
    })
  })

  describe('set', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should set value in all cache layers', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, undefined)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should set value with maxAge in all cache layers', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 3600
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set(key, value, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache2.set).toHaveBeenCalledWith(key, value, maxAge)
      expect(mockCache3.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return true if at least one cache successfully sets value', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValueOnce(false)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all caches fail to set value', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockCache1.set.mockResolvedValueOnce(false)
      mockCache2.set.mockResolvedValueOnce(false)
      mockCache3.set.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should work with empty cache layers', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])
      const key = 'test-key'
      const value = 'test-value'

      // Act
      const result = await multilayeredCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should set value with maxAge of 0', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 0
      mockCache1.set.mockResolvedValueOnce(true)
      mockCache2.set.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set(key, value, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith(key, value, 0)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return true if any cache has the key', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith(key)
      expect(mockCache2.has).toHaveBeenCalledWith(key)
      expect(mockCache3.has).toHaveBeenCalledWith(key)
    })

    it('should return true if first cache has the key', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true if last cache has the key', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if no cache has the key', async () => {
      // Arrange
      const key = 'test-key'
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache3.has.mockResolvedValueOnce(false)

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(false)
    })

    it('should work with empty cache layers', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])
      const key = 'test-key'

      // Act
      const result = await multilayeredCache.has(key)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.has('key1')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats.hits).toBeDefined()
      expect(stats.total).toBeDefined()
      expect(stats.hitRate).toBeDefined()
    })

    it('should return stats with custom name', async () => {
      // Arrange
      const customName = 'my-custom-cache'
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.has('key1')
      const stats = multilayeredCache.getStats(customName)

      // Assert
      expect(stats.name).toBe(customName)
    })

    it('should calculate hitRate correctly', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.has.mockResolvedValueOnce(false)

      // Act
      await multilayeredCache.has('key1')
      await multilayeredCache.has('key2')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should return undefined hitRate when total is 0', async () => {
      // Arrange
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should track hits and misses from get operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value1')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return 100% hitRate when all reads are hits', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.has('key1')
      await multilayeredCache.has('key2')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return cumulative stats', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.has('key1')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBeDefined()
      expect(stats.misses).toBeDefined()
      expect(stats.total).toBeDefined()
    })

    it('should track hits in cumulative stats', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.has('key1')
      await multilayeredCache.has('key2')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(0)
      expect(stats.total).toBe(2)
    })

    it('should track misses in cumulative stats', async () => {
      // Arrange
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      await multilayeredCache.has('key1')
      await multilayeredCache.has('key2')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should return zeros on initial call', async () => {
      // Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('edge cases and error scenarios', () => {
    it('should handle single cache layer', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('key')

      // Assert
      expect(result).toBe('value')
    })

    it('should handle get with null-like value', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
      mockCache1.get.mockResolvedValueOnce(null as any)
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('key')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle numeric keys', async () => {
      // Arrange
      const multilayeredCacheNum = new MultilayeredCache<number, string>([mockCache1, mockCache2])
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCacheNum.get(123)

      // Assert
      expect(result).toBe('value')
      expect(mockCache1.get).toHaveBeenCalledWith(123)
    })

    it('should handle object values', async () => {
      // Arrange
      const multilayeredCacheObj = new MultilayeredCache<string, { id: number; name: string }>([
        mockCache1,
      ])
      const objValue = { id: 1, name: 'test' }
      mockCache1.get.mockResolvedValueOnce(objValue)
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCacheObj.get('key')

      // Assert
      expect(result).toEqual(objValue)
    })

    it('should handle promise rejection from cache.get', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
      mockCache1.get.mockRejectedValueOnce(new Error('Cache error'))
      mockCache1.has.mockResolvedValueOnce(false)

      // Act & Assert
      await expect(multilayeredCache.get('key')).rejects.toThrow('Cache error')
    })

    it('should handle promise rejection from cache.has', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
      mockCache1.has.mockRejectedValueOnce(new Error('Cache error'))

      // Act & Assert
      await expect(multilayeredCache.has('key')).rejects.toThrow('Cache error')
    })

    it('should handle promise rejection from cache.set', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
      mockCache1.set.mockRejectedValueOnce(new Error('Cache error'))

      // Act & Assert
      await expect(multilayeredCache.set('key', 'value')).rejects.toThrow('Cache error')
    })

    it('should handle empty string key', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValueOnce('value')
      mockCache1.has.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.get('')

      // Assert
      expect(result).toBe('value')
      expect(mockCache1.get).toHaveBeenCalledWith('')
    })

    it('should handle empty string value', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1])
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('key', '')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', '', undefined)
    })

    it('should handle large maxAge value', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1])
      const largeMaxAge = Number.MAX_SAFE_INTEGER
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('key', 'value', largeMaxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', largeMaxAge)
    })

    it('should handle negative maxAge value', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1])
      const negativeMaxAge = -1
      mockCache1.set.mockResolvedValueOnce(true)

      // Act
      const result = await multilayeredCache.set('key', 'value', negativeMaxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key', 'value', negativeMaxAge)
    })

    it('should handle multiple reads for stats tracking', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
      mockCache1.get.mockResolvedValueOnce('value1')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache1.get.mockResolvedValueOnce(undefined)
      mockCache1.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      const stats = multilayeredCache.getStats()
      const cumulativeStats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
      expect(cumulativeStats.hits).toBe(1)
      expect(cumulativeStats.misses).toBe(1)
    })
  })
})
