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
    it('should initialize with an array of caches', () => {
      // Arrange & Act
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])

      // Assert
      expect(multilayeredCache).toBeDefined()
    })

    it('should initialize with an empty array of caches', () => {
      // Arrange & Act
      multilayeredCache = new MultilayeredCache([])

      // Assert
      expect(multilayeredCache).toBeDefined()
    })
  })

  describe('get', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return value from first cache when key exists', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('value1')
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).not.toHaveBeenCalled()
    })

    it('should return value from second cache when first does not have key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('value2')
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).toHaveBeenCalledWith('key1')
      expect(mockCache3.has).not.toHaveBeenCalled()
    })

    it('should return value from third cache when first two do not have key', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue('value3')
      mockCache3.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('value3')
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).toHaveBeenCalledWith('key1')
      expect(mockCache3.has).toHaveBeenCalledWith('key1')
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

    it('should fetch and cache value when key not found but fetcher provided', async () => {
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
        value: 'fetchedValue',
        maxAge: 3600,
      })

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetchedValue')
      expect(fetcher).toHaveBeenCalled()
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetchedValue', 3600)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'fetchedValue', 3600)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'fetchedValue', 3600)
    })

    it('should fetch without maxAge when fetcher returns no maxAge', async () => {
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
        value: 'fetchedValue',
      })

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetchedValue')
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetchedValue', undefined)
    })

    it('should populate failed caches when value found in later cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value2', undefined)
      expect(mockCache2.set).not.toHaveBeenCalled()
      expect(mockCache3.set).not.toHaveBeenCalled()
    })

    it('should populate all caches when value fetched from fetcher', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(true)

      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetchedValue',
      })

      // Act
      await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'fetchedValue', undefined)
      expect(mockCache2.set).toHaveBeenCalledWith('key1', 'fetchedValue', undefined)
      expect(mockCache3.set).toHaveBeenCalledWith('key1', 'fetchedValue', undefined)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])
      const fetcher = jest.fn().mockResolvedValue({
        value: 'fetchedValue',
      })

      // Act
      const result = await multilayeredCache.get('key1', fetcher)

      // Assert
      expect(result).toBe('fetchedValue')
    })

    it('should handle null value from cache', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(null)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle promises resolving in parallel during search', async () => {
      // Arrange
      mockCache1.get.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(undefined), 50)))
      mockCache1.has.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(false), 50)))
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.get('key1')

      // Assert
      expect(result).toBe('value2')
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

    it('should return true when at least one cache succeeds', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when all caches fail', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(false)

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

    it('should handle null value', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.set('key1', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key1', null, undefined)
    })

    it('should handle zero maxAge', async () => {
      // Arrange
      mockCache1.set.mockResolvedValue(true)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.set.mockResolvedValue(true)

      // Act
      const result = await multilayeredCache.set('key1', 'value1', 0)

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.set).toHaveBeenCalledWith('key1', 'value1', 0)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should return true when key exists in first cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(true)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(true)
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).toHaveBeenCalledWith('key1')
      expect(mockCache3.has).toHaveBeenCalledWith('key1')
    })

    it('should return true when key exists in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(true)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when key does not exist in any cache', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty cache array', async () => {
      // Arrange
      multilayeredCache = new MultilayeredCache([])

      // Act
      const result = await multilayeredCache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should check all caches in parallel', async () => {
      // Arrange
      mockCache1.has.mockResolvedValue(false)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.has('key1')

      // Assert
      expect(mockCache1.has).toHaveBeenCalledWith('key1')
      expect(mockCache2.has).toHaveBeenCalledWith('key1')
      expect(mockCache3.has).toHaveBeenCalledWith('key1')
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return stats with default name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.get('key1')
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.name).toBe('multilayred-cache')
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(1)
      expect(stats.hitRate).toBe(1)
    })

    it('should return stats with custom name', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)

      // Act
      await multilayeredCache.get('key1')
      const stats = multilayeredCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.get('key1') // hit
      await multilayeredCache.get('key2') // miss
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(1)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is zero', async () => {
      // Arrange & Act
      const stats = multilayeredCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.total).toBe(0)
      expect(stats.hits).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should return cumulative stats', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.get('key1') // hit
      await multilayeredCache.get('key2') // miss
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })

    it('should return zero stats when no operations performed', async () => {
      // Arrange & Act
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })

    it('should track multiple hits and misses', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.get('key1') // hit
      await multilayeredCache.get('key2') // miss
      await multilayeredCache.get('key3') // miss
      await multilayeredCache.get('key4') // hit
      const stats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(4)
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2, mockCache3])
    })

    it('should handle complex flow with get, set, and has operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache1.set.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache2.set.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)
      mockCache3.set.mockResolvedValue(true)

      const fetcher = jest.fn().mockResolvedValue({
        value: 'newValue',
        maxAge: 3600,
      })

      // Act
      const getValue = await multilayeredCache.get('testKey', fetcher)
      const hasKey = await multilayeredCache.has('testKey')
      const setResult = await multilayeredCache.set('testKey', 'anotherValue', 7200)

      // Assert
      expect(getValue).toBe('newValue')
      expect(hasKey).toBe(true)
      expect(setResult).toBe(true)
    })

    it('should maintain separate stats for windowed and cumulative', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)
      mockCache3.get.mockResolvedValue(undefined)
      mockCache3.has.mockResolvedValue(false)

      // Act
      await multilayeredCache.get('key1') // hit
      await multilayeredCache.get('key2') // miss
      const windowedStats = multilayeredCache.getStats()
      const cumulativeStats = multilayeredCache.getCumulativeStats()

      // Assert
      expect(windowedStats.total).toBe(2)
      expect(windowedStats.hits).toBe(1)
      expect(cumulativeStats.total).toBe(2)
      expect(cumulativeStats.hits).toBe(1)
      expect(cumulativeStats.misses).toBe(1)
    })

    it('should handle concurrent get operations', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)
      mockCache3.get.mockResolvedValue('value3')
      mockCache3.has.mockResolvedValue(true)

      // Act
      const [result1, result2, result3] = await Promise.all([
        multilayeredCache.get('key1'),
        multilayeredCache.get('key2'),
        multilayeredCache.get('key3'),
      ])

      // Assert
      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
      expect(result3).toBe('value3')
    })
  })

  describe('edge cases and error scenarios', () => {
    beforeEach(() => {
      multilayeredCache = new MultilayeredCache([mockCache1, mockCache2])
    })

    it('should handle rejection from cache.has during search', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockRejectedValue(new Error('Cache error'))

      // Act & Assert
      await expect(multilayeredCache.get('key1')).rejects.toThrow('Cache error')
    })

    it('should handle rejection from cache.get during search', async () => {
      // Arrange
      mockCache1.get.mockRejectedValue(new Error('Get error'))
      mockCache1.has.mockResolvedValue(false)

      // Act & Assert
      await expect(multilayeredCache.get('key1')).rejects.toThrow('Get error')
    })

    it('should handle rejection from fetcher', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue(undefined)
      mockCache2.has.mockResolvedValue(false)

      const fetcher = jest.fn().mockRejectedValue(new Error('Fetch error'))

      // Act & Assert
      await expect(multilayeredCache.get('key1', fetcher)).rejects.toThrow('Fetch error')
    })

    it('should handle rejection from cache.set during population', async () => {
      // Arrange
      mockCache1.get.mockResolvedValue(undefined)
      mockCache1.has.mockResolvedValue(false)
      mockCache2.get.mockResolvedValue('value2')
      mockCache2.has.mockResolvedValue(true)
      mockCache1.set.mockRejectedValue(new Error('Set error'))

      // Act & Assert
      await expect(multilayeredCache.get('key1')).rejects.toThrow('Set error')
    })

    it('should handle single cache gracefully', async () => {
      // Arrange
      const singleCache = new MultilayeredCache([mockCache1])
      mockCache1.get.mockResolvedValue('value1')
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await singleCache.get('key1')

      // Assert
      expect(result).toBe('value1')
    })

    it('should handle numeric keys and values', async () => {
      // Arrange
      const numericCache = new MultilayeredCache<number, number>([
        mockCache1 as any,
        mockCache2 as any,
      ])
      mockCache1.get.mockResolvedValue(42)
      mockCache1.has.mockResolvedValue(true)

      // Act
      const result = await numericCache.get(1)

      // Assert
      expect(result).toBe(42)
      expect(mockCache1.has).toHaveBeenCalledWith(1)
    })
  })
})
