import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')

describe('LRUCache', () => {
  let mockLRUInstance: jest.Mocked<LRU<any, any>>
  let mockMultilayerInstance: jest.Mocked<MultilayeredCache<any, any>>
  let cache: LRUCache<string, string>

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Mock LRU instance
    mockLRUInstance = {
      get: jest.fn(),
      set: jest.fn().mockReturnValue(true),
      has: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as any

    // Mock MultilayeredCache instance
    mockMultilayerInstance = {
      get: jest.fn().mockResolvedValue('value'),
    } as any

    // Mock LRU constructor
    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRUInstance)

    // Mock MultilayeredCache constructor
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => mockMultilayerInstance
    )

    // Create cache instance
    cache = new LRUCache<string, string>({ max: 1000 })
  })

  describe('constructor', () => {
    it('should initialize with default stats', () => {
      // Act & Assert
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create LRU storage with provided options', () => {
      // Act & Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 1000,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should create MultilayeredCache with this instance', () => {
      // Act & Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([cache])
    })

    it('should initialize reported stats to zero', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })
  })

  describe('get', () => {
    it('should return value from storage when key exists', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRUInstance.get.mockReturnValue(value)
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockLRUInstance.get).toHaveBeenCalledWith(key)
    })

    it('should increment hits when key exists', () => {
      // Arrange
      const key = 'test-key'
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')

      // Act
      cache.get(key)
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
    })

    it('should increment total on every get call', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(3)
    })

    it('should not increment hits when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      cache.get('nonexistent-key')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should return undefined when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      const result = cache.get('nonexistent-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle multiple sequential gets correctly', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key1')
      cache.get('key2')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(3)
    })

    it('should handle null values stored in cache', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue(null as any)

      // Act
      const result = cache.get('key')

      // Assert
      expect(result).toBeNull()
      expect(cache.getCumulativeStats().hits).toBe(1)
    })
  })

  describe('set', () => {
    it('should set value in storage', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'

      // Act
      cache.set(key, value)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should set value with maxAge parameter', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 5000

      // Act
      cache.set(key, value, maxAge)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return boolean from storage.set', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      const result = cache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle set returning false', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(false)

      // Act
      const result = cache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle null values', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      cache.set('key', null as any)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', null, undefined)
    })

    it('should handle zero maxAge', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      cache.set('key', 'value', 0)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value', 0)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.has('existing-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('existing-key')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.has('nonexistent-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle multiple has calls', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValueOnce(true).mockReturnValueOnce(false)

      // Act
      const result1 = cache.has('key1')
      const result2 = cache.has('key2')

      // Assert
      expect(result1).toBe(true)
      expect(result2).toBe(false)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer.get', async () => {
      // Arrange
      const key = 'test-key'
      const fetcher = jest.fn()
      mockMultilayerInstance.get.mockResolvedValue('result')

      // Act
      const result = await cache.getOrSet(key, fetcher)

      // Assert
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith(key, fetcher)
      expect(result).toBe('result')
    })

    it('should handle fetcher undefined', async () => {
      // Arrange
      const key = 'test-key'
      mockMultilayerInstance.get.mockResolvedValue('result')

      // Act
      const result = await cache.getOrSet(key)

      // Assert
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith(key, undefined)
      expect(result).toBe('result')
    })

    it('should handle async operations', async () => {
      // Arrange
      const key = 'test-key'
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })
      mockMultilayerInstance.get.mockResolvedValue('fetched')

      // Act
      const result = await cache.getOrSet(key, fetcher)

      // Assert
      expect(result).toBe('fetched')
    })

    it('should handle rejection from multilayer', async () => {
      // Arrange
      const key = 'test-key'
      const error = new Error('Fetch failed')
      mockMultilayerInstance.get.mockRejectedValue(error)

      // Act & Assert
      await expect(cache.getOrSet(key)).rejects.toThrow('Fetch failed')
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      cache.get('key')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('lru-cache')
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      cache.get('key')

      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValueOnce(true).mockReturnValueOnce(false)
      cache.get('key1')
      cache.get('key2')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
    })

    it('should return undefined hit rate when total is zero', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return 1.0 hit rate when all hits', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      cache.get('key1')
      cache.get('key2')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1.0)
    })

    it('should return 0 hit rate when no hits', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      mockLRUInstance.has.mockReturnValue(false)
      cache.get('key1')
      cache.get('key2')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
    })

    it('should track disposed items', () => {
      // Arrange
      const options = { max: 1000 }
      cache = new LRUCache<string, string>(options)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[
        (LRU as jest.MockedClass<typeof LRU>).mock.calls.length - 1
      ][0].dispose

      // Act
      disposeCallback?.()
      disposeCallback?.()
      const stats = cache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })

    it('should reset reported stats after getStats call', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      cache.get('key1')
      const stats1 = cache.getStats()

      // Act - add more hits after first getStats
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      cache.get('key2')
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })

    it('should include storage properties in stats', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(100)
      expect(stats.max).toBe(1000)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValueOnce(true).mockReturnValueOnce(false)
      cache.get('key1')
      cache.get('key2')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
      expect(stats.disposedItems).toBe(0)
    })

    it('should not reset stats after getCumulativeStats', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      cache.get('key1')
      const stats1 = cache.getCumulativeStats()

      // Act
      cache.get('key2')
      const stats2 = cache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(2)
      expect(stats2.total).toBe(2)
    })

    it('should include all storage properties', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 0,
        hits: 0,
        itemCount: 5,
        length: 100,
        max: 1000,
        total: 0,
      })
    })

    it('should track disposed items in cumulative stats', () => {
      // Arrange
      const options = { max: 1000 }
      cache = new LRUCache<string, string>(options)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[
        (LRU as jest.MockedClass<typeof LRU>).mock.calls.length - 1
      ][0].dispose

      // Act
      disposeCallback?.()
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(1)
    })
  })

  describe('dispose callback', () => {
    it('should increment disposed counter when item is disposed', () => {
      // Arrange
      const options = { max: 1000 }
      cache = new LRUCache<string, string>(options)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[
        (LRU as jest.MockedClass<typeof LRU>).mock.calls.length - 1
      ][0].dispose

      // Act
      disposeCallback?.()
      disposeCallback?.()
      disposeCallback?.()
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3)
    })

    it('should have noDisposeOnSet set to true', () => {
      // Arrange
      const options = { max: 1000 }

      // Act
      cache = new LRUCache<string, string>(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          noDisposeOnSet: true,
        })
      )
    })
  })

  describe('integration scenarios', () => {
    it('should handle realistic cache operations', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1')
      cache.get('key1')
      cache.get('missing-key')
      cache.get('key1')
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
      expect(stats.hitRate).toBe(2 / 3)
    })

    it('should maintain separate stats between getStats calls', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      cache.get('key1')
      cache.get('key2')
      const stats1 = cache.getStats()

      cache.get('key3')
      cache.get('key4')
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats1.total).toBe(2)
      expect(stats2.hits).toBe(2)
      expect(stats2.total).toBe(2)
    })

    it('should support generic types correctly', () => {
      // Arrange
      interface CustomType {
        id: number
        name: string
      }
      const customCache = new LRUCache<string, CustomType>({ max: 100 })
      const obj: CustomType = { id: 1, name: 'test' }
      mockLRUInstance.get.mockReturnValue(obj)
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      customCache.set('key', obj)
      const result = customCache.get('key')

      // Assert
      expect(result).toEqual(obj)
    })
  })
})
