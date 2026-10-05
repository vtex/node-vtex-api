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
      getStats: jest.fn(),
      getCumulativeStats: jest.fn(),
    }
    mockCache2 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      getStats: jest.fn(),
      getCumulativeStats: jest.fn(),
    }
    mockCache3 = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      getStats: jest.fn(),
      getCumulativeStats: jest.fn(),
    }
  })

  describe('constructor', () => {
    it('should initialize with provided cache layers', () => {
      // Arrange & Act
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Assert
      expect(multilayeredCache).toBeInstanceOf(MultilayeredCache)
    })

    it('should initialize with empty cache layers array', () => {
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

    it('should return value from first cache that has the key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('value2')
      expect(mockCache1.get).toHaveBeenCalledWith('key1')
      expect(mockCache2.get).toHaveBeenCalledWith('key1')
      expect(mockCache3.get).not.toHaveBeenCalled()
    })

    it('should return value from first cache layer', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('value1')
      expect(mockCache2.get).not.toHaveBeenCalled()
      expect(mockCache3.get).not.toHaveBeenCalled()
    })

    it('should populate earlier caches when value found in later cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue('value3')
      mockCache3.has.mockResolvedValue(true)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('value3')
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value3', undefined)
      expect(mockCache2.set).not.toHaveBeenCalled()
    })

    it('should use fetcher when key not found in any cache', async () => {
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
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched', maxAge: 3600 })

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetched', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'fetched', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'fetched', 3600)
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
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle fetcher with no maxAge', async () => {
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
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetched', undefined)
    })

    it('should handle empty cache layers', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetched')
      expect(fetcher).toHaveBeenCalled()
    })

    it('should track hits when key found', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should track misses when key not found', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })

      // Act
      await multilayeredCache.get('key1', fetcher)
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should resolve with value when get operation throws', async () => {
      // Arrange
      mockCache1.get.mockRejectedValue(new Error('Cache error'))
      mockCache1.has.mockResolvedValue(false)

      // Act & Assert
      await expect(multilayeredCache.get('key1')).rejects.toThrow('Cache error')
    })
  })

  describe('set', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should set value in all caches', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'value1', undefined)
    })

    it('should set value with maxAge in all caches', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.set('key1', 'value1', 3600)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value1', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'value1', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'value1', 3600)
    })

    it('should return true if at least one cache set succeeds', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if all caches fail to set', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache layers', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle set operation throwing', async () => {
      // Arrange
      mockCache1.set.mockRejectedValue(new Error('Set error'))

      // Act & Assert
      await expect(multilayeredCache.set('key1', 'value1')).rejects.toThrow('Set error')
    })
  })

  describe('has', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return true if key exists in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).toHaveBeenCalledWith('key1')
      expect(mockCache3.has).toHaveBeenCalledWith('key1')
    })

    it('should return true if key exists in first cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if key does not exist in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache layers', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle has operation throwing', async () => {
      // Arrange
      mockCache1.has.mockRejectedValue(new Error('Has error'))

      // Act & Assert
      await expect(multilayeredCache.has('key1')).rejects.toThrow('Has error')
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
      expect(stats.hitRate).toBe(1)
    })

    it('should return stats with custom name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')
      const stats = multilayeredCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2', fetcher)
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should return undefined hitRate when total is 0', async () => {
      // Arrange
      // Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should reset reported stats after call', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
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

    it('should handle multiple calls to getStats', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      await multilayeredCache.get('key3')
      multilayeredCache.getStats()
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return cumulative stats with correct hit count', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should return cumulative stats with correct miss count', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })

      // Act
      await multilayeredCache.get('key1', fetcher)
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should return cumulative stats that persist across getStats calls', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      multilayeredCache.getStats()
      const cumulativeStats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.hits).toBe(2)
      expect(cumulativeStats.total).toBe(2)
    })

    it('should return initial stats when no operations performed', () => {
      // Arrange & Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should accumulate stats across multiple operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })

      // Act
      await multilayeredCache.get('key1')
      await multilayeredCache.get('key2')
      await multilayeredCache.get('key3', fetcher)
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
    })
  })

  describe('Integration tests', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should populate early caches on cache miss and fetcher success', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue('value3')
      mockCache3.has.mockResolvedValue(true)
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched', maxAge: 1800 })

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('value3')
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value3', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'value3', undefined)
      expect(fetcher).not.toHaveBeenCalled()
    })

    it('should handle multiple consecutive gets with varying cache hits', async () => {
      // Arrange
      mockCache1.get.mockResolvedValueOnce('value1')
      mockCache1.has.mockResolvedValueOnce(true)
      mockCache2.get.mockResolvedValueOnce(undefined)
      mockCache2.has.mockResolvedValueOnce(false)
      mockCache2.get.mockResolvedValueOnce('value2')
      mockCache2.has.mockResolvedValueOnce(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result1 = await multilayeredCache.get('key1')
      const result2 = await multilayeredCache.get('key2')
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should handle set followed by get', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const setResult = await multilayeredCache.set('key1', 'value1', 3600)
      const getResult = await multilayeredCache.get('key1')

      // Assert
      expect(setResult).toBe(true)
      expect(getResult).toBe('value1')
    })
  })
})
