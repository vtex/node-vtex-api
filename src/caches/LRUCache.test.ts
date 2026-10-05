import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')

describe('LRUCache', () => {
  let mockLRUStorage: jest.Mocked<LRU<string, string>>
  let mockMultilayer: jest.Mocked<MultilayeredCache<string, string>>
  let lruCache: LRUCache<string, string>

  beforeEach(() => {
    // Setup LRU mock
    mockLRUStorage = {
      get: jest.fn(),
      has: jest.fn(),
      set: jest.fn(),
      itemCount: 5,
      length: 10,
      max: 100,
    } as any

    // Mock LRU constructor
    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(
      () => mockLRUStorage
    )

    // Setup MultilayeredCache mock
    mockMultilayer = {
      get: jest.fn(),
    } as any

    // Mock MultilayeredCache constructor
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => mockMultilayer
    )

    // Create instance
    lruCache = new LRUCache<string, string>({ max: 100 })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default stats counters', () => {
      // Arrange & Act
      const cache = new LRUCache<string, string>({ max: 50 })

      // Assert
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create LRU storage with provided options', () => {
      // Arrange
      const options = { max: 200, maxSize: 1000 }

      // Act
      const cache = new LRUCache<string, string>(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 200,
          maxSize: 1000,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should set dispose handler that increments disposed counter', () => {
      // Arrange
      const options = { max: 100 }
      let disposeHandler: () => void

      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(
        (opts: any) => {
          disposeHandler = opts.dispose
          return mockLRUStorage
        }
      )

      // Act
      new LRUCache<string, string>(options)
      disposeHandler!()
      disposeHandler!()

      // Assert
      expect(lruCache.getCumulativeStats().disposedItems).toBe(0) // Previous instance
    })

    it('should initialize MultilayeredCache with self as layer', () => {
      // Arrange & Act
      new LRUCache<string, string>({ max: 100 })

      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(LRUCache)])
      )
    })
  })

  describe('get', () => {
    it('should return value and increment hits when key exists', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('test-value')
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      const result = lruCache.get('test-key')

      // Assert
      expect(result).toBe('test-value')
      expect(mockLRUStorage.get).toHaveBeenCalledWith('test-key')
      const stats = lruCache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should return value without incrementing hits when key does not exist', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(undefined)
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      const result = lruCache.get('nonexistent-key')

      // Assert
      expect(result).toBeUndefined()
      const stats = lruCache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should increment total counter on every call', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(undefined)
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      lruCache.get('key1')
      lruCache.get('key2')
      lruCache.get('key3')

      // Assert
      const stats = lruCache.getStats()
      expect(stats.total).toBe(3)
    })

    it('should handle multiple hits and misses', () => {
      // Arrange
      mockLRUStorage.has.mockImplementation((key) => key === 'existing')
      mockLRUStorage.get.mockImplementation((key) =>
        key === 'existing' ? 'value' : undefined
      )

      // Act
      lruCache.get('existing')
      lruCache.get('missing')
      lruCache.get('existing')

      // Assert
      const stats = lruCache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
    })

    it('should work with null values', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(null as any)
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      const result = lruCache.get('null-key')

      // Assert
      expect(result).toBeNull()
      const stats = lruCache.getStats()
      expect(stats.hits).toBe(1)
    })
  })

  describe('set', () => {
    it('should call storage.set with key and value', () => {
      // Arrange
      mockLRUStorage.set.mockReturnValue(mockLRUStorage as any)

      // Act
      lruCache.set('test-key', 'test-value')

      // Assert
      expect(mockLRUStorage.set).toHaveBeenCalledWith(
        'test-key',
        'test-value',
        undefined
      )
    })

    it('should pass maxAge parameter to storage.set', () => {
      // Arrange
      mockLRUStorage.set.mockReturnValue(mockLRUStorage as any)

      // Act
      lruCache.set('test-key', 'test-value', 5000)

      // Assert
      expect(mockLRUStorage.set).toHaveBeenCalledWith(
        'test-key',
        'test-value',
        5000
      )
    })

    it('should return the result from storage.set', () => {
      // Arrange
      mockLRUStorage.set.mockReturnValue(mockLRUStorage as any)

      // Act
      const result = lruCache.set('key', 'value')

      // Assert
      expect(result).toBe(mockLRUStorage)
    })

    it('should handle numeric keys and values', () => {
      // Arrange
      const numCache = new LRUCache<number, number>({ max: 100 })
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(
        () => mockLRUStorage as any
      )
      mockLRUStorage.set.mockReturnValue(mockLRUStorage as any)

      // Act
      numCache.set(42, 100)

      // Assert
      expect(mockLRUStorage.set).toHaveBeenCalledWith(42, 100, undefined)
    })

    it('should handle object keys and values', () => {
      // Arrange
      const objCache = new LRUCache<object, object>({ max: 100 })
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(
        () => mockLRUStorage as any
      )
      mockLRUStorage.set.mockReturnValue(mockLRUStorage as any)
      const key = { id: 1 }
      const value = { data: 'test' }

      // Act
      objCache.set(key, value)

      // Assert
      expect(mockLRUStorage.set).toHaveBeenCalledWith(key, value, undefined)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      const result = lruCache.has('existing-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.has).toHaveBeenCalledWith('existing-key')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      const result = lruCache.has('nonexistent-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUStorage.has).toHaveBeenCalledWith('nonexistent-key')
    })

    it('should call storage.has with the correct key', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      lruCache.has('specific-key')

      // Assert
      expect(mockLRUStorage.has).toHaveBeenCalledWith('specific-key')
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer.get', async () => {
      // Arrange
      const fetcher = jest.fn()
      mockMultilayer.get.mockResolvedValue('result')

      // Act
      const result = await lruCache.getOrSet('key', fetcher)

      // Assert
      expect(result).toBe('result')
      expect(mockMultilayer.get).toHaveBeenCalledWith('key', fetcher)
    })

    it('should call multilayer.get without fetcher', async () => {
      // Arrange
      mockMultilayer.get.mockResolvedValue('result')

      // Act
      const result = await lruCache.getOrSet('key')

      // Assert
      expect(result).toBe('result')
      expect(mockMultilayer.get).toHaveBeenCalledWith('key', undefined)
    })

    it('should handle async fetcher', async () => {
      // Arrange
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })
      mockMultilayer.get.mockImplementation((key, fn) =>
        Promise.resolve('multilayer-result')
      )

      // Act
      const result = await lruCache.getOrSet('key', fetcher)

      // Assert
      expect(result).toBe('multilayer-result')
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.name).toBe('lru-cache')
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
      expect(stats.disposedItems).toBe(0)
    })

    it('should return stats with custom name', () => {
      // Arrange & Act
      const stats = lruCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should include itemCount from storage', () => {
      // Arrange
      mockLRUStorage.itemCount = 25

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.itemCount).toBe(25)
    })

    it('should include length from storage', () => {
      // Arrange
      mockLRUStorage.length = 150

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.length).toBe(150)
    })

    it('should include max from storage', () => {
      // Arrange
      mockLRUStorage.max = 500

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.max).toBe(500)
    })

    it('should calculate hitRate correctly when total > 0', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockImplementation((key) => key === 'hit')
      lruCache.get('hit')
      lruCache.get('miss')
      lruCache.get('hit')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(2 / 3)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange & Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should calculate stats relative to last reported values', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.get('key2')
      const firstStats = lruCache.getStats()

      // Act
      lruCache.get('key3')
      lruCache.get('key4')
      const secondStats = lruCache.getStats()

      // Assert
      expect(firstStats.hits).toBe(2)
      expect(firstStats.total).toBe(2)
      expect(secondStats.hits).toBe(2)
      expect(secondStats.total).toBe(2)
    })

    it('should reset reported counters after getStats call', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValue(true)
      lruCache.get('key1')
      const firstStats = lruCache.getStats()

      // Act
      lruCache.get('key2')
      const secondStats = lruCache.getStats()

      // Assert
      expect(firstStats.hits).toBe(1)
      expect(secondStats.hits).toBe(1)
    })

    it('should track disposed items in stats', () => {
      // Arrange
      let disposeHandler: () => void
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(
        (opts: any) => {
          disposeHandler = opts.dispose
          return mockLRUStorage
        }
      )
      const cache = new LRUCache<string, string>({ max: 100 })

      // Act
      disposeHandler!()
      disposeHandler!()
      const stats = cache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should include storage metrics in cumulative stats', () => {
      // Arrange
      mockLRUStorage.itemCount = 10
      mockLRUStorage.length = 50
      mockLRUStorage.max = 100

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(10)
      expect(stats.length).toBe(50)
      expect(stats.max).toBe(100)
    })

    it('should return all-time stats regardless of getStats calls', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.getStats() // Reset reported counters
      lruCache.get('key2')

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should include disposed items in cumulative stats', () => {
      // Arrange
      let disposeHandler: () => void
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(
        (opts: any) => {
          disposeHandler = opts.dispose
          return mockLRUStorage
        }
      )
      const cache = new LRUCache<string, string>({ max: 100 })
      disposeHandler!()
      disposeHandler!()
      disposeHandler!()

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3)
    })

    it('should not have hitRate property in cumulative stats', () => {
      // Arrange & Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats).not.toHaveProperty('hitRate')
      expect(stats).not.toHaveProperty('name')
    })
  })

  describe('integration scenarios', () => {
    it('should track stats across multiple operations', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockImplementation((key) => key.includes('hit'))
      mockLRUStorage.set.mockReturnValue(mockLRUStorage as any)

      // Act
      lruCache.set('key1', 'value1')
      lruCache.get('hit-key')
      lruCache.get('miss-key')
      lruCache.get('hit-key')
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
      expect(stats.hitRate).toBeCloseTo(2 / 3)
    })

    it('should handle get after has', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(true)
      mockLRUStorage.get.mockReturnValue('cached-value')

      // Act
      const hasResult = lruCache.has('key')
      const getResult = lruCache.get('key')
      const stats = lruCache.getStats()

      // Assert
      expect(hasResult).toBe(true)
      expect(getResult).toBe('cached-value')
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should maintain separate hit/total tracking', () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue('value')
      mockLRUStorage.has.mockReturnValue(false)
      const cache1 = new LRUCache<string, string>({ max: 100 })
      const cache2 = new LRUCache<string, string>({ max: 100 })

      // Mock for cache1
      const mockStorage1 = {
        get: jest.fn().mockReturnValue('value'),
        has: jest.fn().mockReturnValue(true),
        set: jest.fn(),
        itemCount: 5,
        length: 10,
        max: 100,
      } as any
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementationOnce(
        () => mockStorage1
      )
      const cacheA = new LRUCache<string, string>({ max: 100 })

      // Mock for cache2
      const mockStorage2 = {
        get: jest.fn().mockReturnValue('value'),
        has: jest.fn().mockReturnValue(false),
        set: jest.fn(),
        itemCount: 3,
        length: 5,
        max: 100,
      } as any
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementationOnce(
        () => mockStorage2
      )
      const cacheB = new LRUCache<string, string>({ max: 100 })

      // Act
      cacheA.get('key')
      cacheB.get('key')
      const statsA = cacheA.getStats('cache-a')
      const statsB = cacheB.getStats('cache-b')

      // Assert
      expect(statsA.name).toBe('cache-a')
      expect(statsB.name).toBe('cache-b')
    })
  })
})
