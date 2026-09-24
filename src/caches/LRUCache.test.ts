import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')

describe('LRUCache', () => {
  let lruCacheMock: jest.Mocked<LRU<string, string>>
  let multilayerCacheMock: jest.Mocked<MultilayeredCache<string, string>>
  let cache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup LRU mock
    lruCacheMock = {
      get: jest.fn(),
      has: jest.fn(),
      set: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as any

    // Setup MultilayeredCache mock
    multilayerCacheMock = {
      get: jest.fn(),
    } as any

    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => lruCacheMock)
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => multilayerCacheMock
    )

    cache = new LRUCache({ max: 1000 })
  })

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 500 })

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 500,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should initialize stats to zero', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 100 })

      // Assert
      const stats = newCache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create MultilayeredCache with current instance', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 200 })

      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([newCache])
    })

    it('should pass through all LRU options to storage', () => {
      // Arrange
      const customOptions = { max: 300, updateAgeOnGet: true }

      // Act
      new LRUCache(customOptions)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 300,
          updateAgeOnGet: true,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })
  })

  describe('get', () => {
    it('should return the value from storage', () => {
      // Arrange
      lruCacheMock.get.mockReturnValue('test-value')
      lruCacheMock.has.mockReturnValue(true)

      // Act
      const result = cache.get('key1')

      // Assert
      expect(result).toBe('test-value')
      expect(lruCacheMock.get).toHaveBeenCalledWith('key1')
    })

    it('should increment hits when key exists', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key1')

      // Assert
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(2)
    })

    it('should increment total on every call', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)
      lruCacheMock.get.mockReturnValue(undefined)

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')

      // Assert
      const stats = cache.getCumulativeStats()
      expect(stats.total).toBe(3)
    })

    it('should not increment hits when key does not exist', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)
      lruCacheMock.get.mockReturnValue(undefined)

      // Act
      cache.get('missing-key')

      // Assert
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should return void when value is not found', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)
      lruCacheMock.get.mockReturnValue(undefined)

      // Act
      const result = cache.get('nonexistent')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle multiple gets with mixed hits and misses', () => {
      // Arrange
      lruCacheMock.get.mockImplementation((key: string) => {
        return key === 'hit' ? 'value' : undefined
      })
      lruCacheMock.has.mockImplementation((key: string) => key === 'hit')

      // Act
      cache.get('hit')
      cache.get('miss')
      cache.get('hit')
      cache.get('miss')

      // Assert
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(4)
    })
  })

  describe('set', () => {
    it('should set value in storage without maxAge', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', 'value1')

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(result).toBe(true)
    })

    it('should set value in storage with maxAge', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', 'value1', 5000)

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith('key1', 'value1', 5000)
      expect(result).toBe(true)
    })

    it('should return boolean from storage set', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(false)

      // Act
      const result = cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle different value types', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)
      const numberCache = new LRUCache<string, number>({ max: 100 })
      ;(numberCache as any).storage = lruCacheMock

      // Act
      numberCache.set('num', 42, 1000)
      numberCache.set('num', 0, 1000)
      numberCache.set('num', -1, 1000)

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledTimes(3)
      expect(lruCacheMock.set).toHaveBeenCalledWith('num', 42, 1000)
      expect(lruCacheMock.set).toHaveBeenCalledWith('num', 0, 1000)
      expect(lruCacheMock.set).toHaveBeenCalledWith('num', -1, 1000)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)

      // Act
      const result = cache.has('existing-key')

      // Assert
      expect(result).toBe(true)
      expect(lruCacheMock.has).toHaveBeenCalledWith('existing-key')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)

      // Act
      const result = cache.has('missing-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should delegate to storage has method', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)

      // Act
      cache.has('key1')
      cache.has('key2')
      cache.has('key3')

      // Assert
      expect(lruCacheMock.has).toHaveBeenCalledTimes(3)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer cache get method', async () => {
      // Arrange
      multilayerCacheMock.get.mockResolvedValue('value')
      const fetcher = jest.fn()

      // Act
      const result = await cache.getOrSet('key1', fetcher)

      // Assert
      expect(multilayerCacheMock.get).toHaveBeenCalledWith('key1', fetcher)
      expect(result).toBe('value')
    })

    it('should call multilayer get without fetcher', async () => {
      // Arrange
      multilayerCacheMock.get.mockResolvedValue(undefined)

      // Act
      await cache.getOrSet('key1')

      // Assert
      expect(multilayerCacheMock.get).toHaveBeenCalledWith('key1', undefined)
    })

    it('should return void from multilayer cache', async () => {
      // Arrange
      multilayerCacheMock.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.getOrSet('key1')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      lruCacheMock.itemCount = 5
      lruCacheMock.length = 100
      lruCacheMock.max = 1000
      lruCacheMock.has.mockReturnValue(true)

      // Act
      cache.get('key1')
      cache.get('key1')
      cache.get('key2')
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('lru-cache')
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(100)
      expect(stats.max).toBe(1000)
    })

    it('should return stats with custom name', () => {
      // Arrange & Act
      const stats = cache.getStats('custom-name')

      // Assert
      expect(stats.name).toBe('custom-name')
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      lruCacheMock.has.mockImplementation((key: string) => key === 'hit')
      lruCacheMock.get.mockImplementation((key: string) => (key === 'hit' ? 'value' : undefined))

      // Act
      cache.get('hit')
      cache.get('hit')
      cache.get('miss')
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
      expect(stats.hitRate).toBe(2 / 3)
    })

    it('should return undefined hitRate when total is zero', () => {
      // Arrange & Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return hitRate of 1 for all hits', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })

    it('should return hitRate of 0 for all misses', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)
      lruCacheMock.get.mockReturnValue(undefined)

      // Act
      cache.get('key1')
      cache.get('key2')
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
    })

    it('should reset reported stats after getStats call', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key2')
      const stats1 = cache.getStats()
      cache.get('key3')
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats1.total).toBe(2)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })

    it('should track disposed items in stats', () => {
      // Arrange
      lruCacheMock.itemCount = 5
      lruCacheMock.length = 100
      lruCacheMock.max = 1000
      const options = { max: 100 }
      const cacheWithDisposal = new LRUCache(options)

      // Access dispose callback to increment disposed counter
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()
      disposeCallback()

      // Act
      const stats = cacheWithDisposal.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })

    it('should reset disposed items after first getStats call', () => {
      // Arrange
      const options = { max: 100 }
      const cacheWithDisposal = new LRUCache(options)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()
      disposeCallback()

      // Act
      const stats1 = cacheWithDisposal.getStats()
      disposeCallback()
      const stats2 = cacheWithDisposal.getStats()

      // Assert
      expect(stats1.disposedItems).toBe(2)
      expect(stats2.disposedItems).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats with all counters', () => {
      // Arrange
      lruCacheMock.itemCount = 10
      lruCacheMock.length = 200
      lruCacheMock.max = 2000
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(3)
      expect(stats.itemCount).toBe(10)
      expect(stats.length).toBe(200)
      expect(stats.max).toBe(2000)
    })

    it('should return disposed items count', () => {
      // Arrange
      const options = { max: 100 }
      const cacheWithDisposal = new LRUCache(options)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()
      disposeCallback()
      disposeCallback()

      // Act
      const stats = cacheWithDisposal.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3)
    })

    it('should not reset stats after getCumulativeStats call', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      const stats1 = cache.getCumulativeStats()
      cache.get('key2')
      const stats2 = cache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats2.hits).toBe(2)
    })

    it('should return zero stats for new cache', () => {
      // Arrange
      const newCache = new LRUCache({ max: 100 })

      // Act
      const stats = newCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })
  })

  describe('dispose callback integration', () => {
    it('should increment disposed counter when dispose is called', () => {
      // Arrange
      const options = { max: 100 }
      const cacheWithDisposal = new LRUCache(options)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Act
      disposeCallback()
      disposeCallback()
      disposeCallback()
      const stats = cacheWithDisposal.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3)
    })

    it('should include noDisposeOnSet in storage options', () => {
      // Arrange & Act
      new LRUCache({ max: 100 })

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          noDisposeOnSet: true,
        })
      )
    })
  })

  describe('edge cases and integration', () => {
    it('should handle rapid get, set, and has operations', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.set('key1', 'value1')
      cache.has('key1')
      cache.get('key1')
      cache.set('key2', 'value2')
      cache.has('key2')
      cache.get('key2')

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledTimes(2)
      expect(lruCacheMock.has).toHaveBeenCalledTimes(2)
      expect(lruCacheMock.get).toHaveBeenCalledTimes(2)
    })

    it('should correctly accumulate stats across multiple getStats calls', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key2')
      const stats1 = cache.getStats()
      cache.get('key3')
      cache.get('key4')
      cache.get('key5')
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats1.total).toBe(2)
      expect(stats2.hits).toBe(3)
      expect(stats2.total).toBe(3)
    })

    it('should handle getStats with custom names for different calls', () => {
      // Arrange & Act
      const stats1 = cache.getStats('cache-1')
      const stats2 = cache.getStats('cache-2')
      const stats3 = cache.getStats()

      // Assert
      expect(stats1.name).toBe('cache-1')
      expect(stats2.name).toBe('cache-2')
      expect(stats3.name).toBe('lru-cache')
    })
  })
})
