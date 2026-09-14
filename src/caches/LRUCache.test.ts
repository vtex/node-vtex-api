import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')

describe('LRUCache', () => {
  let mockLRUStorage: jest.Mocked<LRU<string, string>>
  let mockMultilayeredCache: jest.Mocked<MultilayeredCache<string, string>>
  let lruCache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    mockLRUStorage = {
      get: jest.fn(),
      set: jest.fn().mockReturnValue(true),
      has: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 200,
      delete: jest.fn(),
      clear: jest.fn(),
    } as any

    mockMultilayeredCache = {
      get: jest.fn(),
    } as any

    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRUStorage)
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => mockMultilayeredCache
    )

    lruCache = new LRUCache({ max: 200 })
  })

  describe('constructor', () => {
    it('should initialize with default statistics', () => {
      // Arrange & Act
      const cache = new LRUCache({ max: 100 })

      // Assert
      expect(cache['hits']).toBe(0)
      expect(cache['total']).toBe(0)
      expect(cache['disposed']).toBe(0)
      expect(cache['reported']).toEqual({ hits: 0, total: 0, disposed: 0 })
    })

    it('should create LRU storage with provided options', () => {
      // Arrange
      const options = { max: 150, ttl: 5000 }

      // Act
      new LRUCache(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 150,
          ttl: 5000,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should initialize MultilayeredCache with the current instance', () => {
      // Arrange & Act
      const cache = new LRUCache({ max: 200 })

      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([cache])
    })

    it('should set up dispose callback to increment disposed counter', () => {
      // Arrange
      const options = { max: 50 }

      // Act
      const cache = new LRUCache(options)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Simulate item disposal
      disposeCallback()
      disposeCallback()

      // Assert
      expect(cache['disposed']).toBe(2)
    })
  })

  describe('get', () => {
    it('should return value from storage and increment hits when key exists', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRUStorage.get.mockReturnValue(value)
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(lruCache['hits']).toBe(1)
      expect(lruCache['total']).toBe(1)
      expect(mockLRUStorage.get).toHaveBeenCalledWith(key)
      expect(mockLRUStorage.has).toHaveBeenCalledWith(key)
    })

    it('should return undefined and not increment hits when key does not exist', () => {
      // Arrange
      const key = 'missing-key'
      mockLRUStorage.get.mockReturnValue(undefined)
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(lruCache['hits']).toBe(0)
      expect(lruCache['total']).toBe(1)
    })

    it('should increment total for every call regardless of hit or miss', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      lruCache.get('key1')
      lruCache.get('key2')
      lruCache.get('key3')

      // Assert
      expect(lruCache['total']).toBe(3)
    })

    it('should handle multiple hits and misses', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(true)

      // Act
      lruCache.get('key1') // hit
      lruCache.get('key2') // miss
      lruCache.get('key3') // hit

      // Assert
      expect(lruCache['hits']).toBe(2)
      expect(lruCache['total']).toBe(3)
    })

    it('should work with different key types', () => {
      // Arrange
      const numericCache = new LRUCache<number, string>({ max: 100 })
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRUStorage)
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      const result = numericCache.get(42)

      // Assert
      expect(result).toBe('value')
      expect(mockLRUStorage.get).toHaveBeenCalledWith(42)
    })
  })

  describe('set', () => {
    it('should set value in storage and return true', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRUStorage.set.mockReturnValue(true)

      // Act
      const result = lruCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should set value with maxAge option', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 5000
      mockLRUStorage.set.mockReturnValue(true)

      // Act
      const result = lruCache.set(key, value, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return false when storage set fails', () => {
      // Arrange
      mockLRUStorage.set.mockReturnValue(false)

      // Act
      const result = lruCache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle zero maxAge', () => {
      // Arrange
      mockLRUStorage.set.mockReturnValue(true)

      // Act
      const result = lruCache.set('key', 'value', 0)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.set).toHaveBeenCalledWith('key', 'value', 0)
    })

    it('should handle large maxAge values', () => {
      // Arrange
      mockLRUStorage.set.mockReturnValue(true)
      const largeMaxAge = Number.MAX_SAFE_INTEGER

      // Act
      const result = lruCache.set('key', 'value', largeMaxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.set).toHaveBeenCalledWith('key', 'value', largeMaxAge)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      const key = 'existing-key'
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      const result = lruCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.has).toHaveBeenCalledWith(key)
    })

    it('should return false when key does not exist', () => {
      // Arrange
      const key = 'missing-key'
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      const result = lruCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(mockLRUStorage.has).toHaveBeenCalledWith(key)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer cache get method', async () => {
      // Arrange
      const key = 'test-key'
      const fetcher = jest.fn()
      mockMultilayeredCache.get.mockResolvedValue('cached-value')

      // Act
      const result = await lruCache.getOrSet(key, fetcher)

      // Assert
      expect(result).toBe('cached-value')
      expect(mockMultilayeredCache.get).toHaveBeenCalledWith(key, fetcher)
    })

    it('should call multilayer get without fetcher when not provided', async () => {
      // Arrange
      const key = 'test-key'
      mockMultilayeredCache.get.mockResolvedValue('value')

      // Act
      await lruCache.getOrSet(key)

      // Assert
      expect(mockMultilayeredCache.get).toHaveBeenCalledWith(key, undefined)
    })

    it('should handle rejected promise from multilayer cache', async () => {
      // Arrange
      const key = 'test-key'
      const error = new Error('Multilayer error')
      mockMultilayeredCache.get.mockRejectedValue(error)

      // Act & Assert
      await expect(lruCache.getOrSet(key)).rejects.toThrow('Multilayer error')
    })

    it('should resolve with undefined when multilayer returns void', async () => {
      // Arrange
      mockMultilayeredCache.get.mockResolvedValue(undefined)

      // Act
      const result = await lruCache.getOrSet('key')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return initial stats with default name', () => {
      // Arrange
      mockLRUStorage.itemCount = 5
      mockLRUStorage.length = 100
      mockLRUStorage.max = 200

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        itemCount: 5,
        length: 100,
        max: 200,
        name: 'lru-cache',
        total: 0,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockLRUStorage.itemCount = 3
      mockLRUStorage.length = 50
      mockLRUStorage.max = 100

      // Act
      const stats = lruCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      mockLRUStorage.itemCount = 2
      mockLRUStorage.length = 40
      mockLRUStorage.max = 100
      lruCache['hits'] = 3
      lruCache['total'] = 10

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.3)
      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(10)
    })

    it('should return undefined hitRate when total is zero', () => {
      // Arrange
      mockLRUStorage.itemCount = 0
      mockLRUStorage.length = 0
      mockLRUStorage.max = 100
      lruCache['hits'] = 0
      lruCache['total'] = 0

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return delta stats (difference from last reported)', () => {
      // Arrange
      mockLRUStorage.itemCount = 5
      mockLRUStorage.length = 100
      mockLRUStorage.max = 200
      lruCache['hits'] = 10
      lruCache['total'] = 15
      lruCache['disposed'] = 3
      lruCache['reported'] = { hits: 3, total: 5, disposed: 1 }

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hits).toBe(7) // 10 - 3
      expect(stats.total).toBe(10) // 15 - 5
      expect(stats.disposedItems).toBe(2) // 3 - 1
    })

    it('should update reported stats after getStats call', () => {
      // Arrange
      mockLRUStorage.itemCount = 5
      mockLRUStorage.length = 100
      mockLRUStorage.max = 200
      lruCache['hits'] = 5
      lruCache['total'] = 8
      lruCache['disposed'] = 2

      // Act
      lruCache.getStats()

      // Assert
      expect(lruCache['reported']).toEqual({
        hits: 5,
        total: 8,
        disposed: 2,
      })
    })

    it('should return zero for all deltas after first call followed by no activity', () => {
      // Arrange
      mockLRUStorage.itemCount = 3
      mockLRUStorage.length = 60
      mockLRUStorage.max = 200
      lruCache.getStats() // First call to set baseline

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
      expect(stats.hitRate).toBeUndefined()
    })

    it('should handle perfect hit rate', () => {
      // Arrange
      mockLRUStorage.itemCount = 10
      mockLRUStorage.length = 200
      mockLRUStorage.max = 500
      lruCache['hits'] = 5
      lruCache['total'] = 5

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })

    it('should handle zero hit rate', () => {
      // Arrange
      mockLRUStorage.itemCount = 2
      mockLRUStorage.length = 50
      mockLRUStorage.max = 200
      lruCache['hits'] = 0
      lruCache['total'] = 5

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockLRUStorage.itemCount = 7
      mockLRUStorage.length = 140
      mockLRUStorage.max = 200
      lruCache['hits'] = 20
      lruCache['total'] = 50
      lruCache['disposed'] = 5

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hits: 20,
        itemCount: 7,
        length: 140,
        max: 200,
        total: 50,
      })
    })

    it('should not reset reported stats', () => {
      // Arrange
      mockLRUStorage.itemCount = 3
      mockLRUStorage.length = 60
      mockLRUStorage.max = 100
      lruCache['hits'] = 15
      lruCache['total'] = 30
      lruCache['disposed'] = 2
      lruCache['reported'] = { hits: 5, total: 10, disposed: 1 }

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(15) // Total, not delta
      expect(stats.total).toBe(30) // Total, not delta
      expect(lruCache['reported']).toEqual({ hits: 5, total: 10, disposed: 1 }) // Unchanged
    })

    it('should return zero values for new cache', () => {
      // Arrange
      mockLRUStorage.itemCount = 0
      mockLRUStorage.length = 0
      mockLRUStorage.max = 100
      const newCache = new LRUCache({ max: 100 })

      // Act
      const stats = newCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 0,
        hits: 0,
        itemCount: 0,
        length: 0,
        max: 100,
        total: 0,
      })
    })

    it('should reflect disposed items from constructor callback', () => {
      // Arrange
      const cache = new LRUCache({ max: 50 })
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()
      disposeCallback()
      disposeCallback()
      mockLRUStorage.itemCount = 1
      mockLRUStorage.length = 20
      mockLRUStorage.max = 50

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3)
    })
  })

  describe('integration scenarios', () => {
    it('should track stats across multiple operations', () => {
      // Arrange
      mockLRUStorage.itemCount = 5
      mockLRUStorage.length = 100
      mockLRUStorage.max = 200
      mockLRUStorage.has.mockReturnValueOnce(true).mockReturnValueOnce(false)
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.set.mockReturnValue(true)

      // Act
      lruCache.get('key1') // hit
      lruCache.get('key2') // miss
      lruCache.set('key3', 'value3')
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(2)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should maintain separate hit/miss tracking across get calls', () => {
      // Arrange
      mockLRUStorage.has
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.itemCount = 3
      mockLRUStorage.length = 60
      mockLRUStorage.max = 200

      // Act
      lruCache.get('a')
      lruCache.get('b')
      lruCache.get('c')
      lruCache.get('d')
      const stats = lruCache.getStats()

      // Assert
      expect(stats.total).toBe(4)
      expect(stats.hits).toBe(3)
      expect(stats.hitRate).toBe(0.75)
    })
  })
})
