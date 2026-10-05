import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'
import { FetchResult } from './typings'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')

describe('LRUCache', () => {
  let mockLRUInstance: jest.Mocked<LRU<string, string>>
  let mockMultilayeredCacheInstance: jest.Mocked<MultilayeredCache<string, string>>
  let cache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock LRU instance
    mockLRUInstance = {
      get: jest.fn(),
      has: jest.fn(),
      set: jest.fn(() => true),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as any

    // Setup mock LRU constructor
    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRUInstance)

    // Setup mock MultilayeredCache instance
    mockMultilayeredCacheInstance = {
      get: jest.fn(),
    } as any
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(() => mockMultilayeredCacheInstance)

    cache = new LRUCache({ max: 1000 })
  })

  describe('constructor', () => {
    it('should initialize with default values', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 100 })

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 100,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should set hits, total, and disposed to 0 on initialization', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 100 })

      // Assert
      const stats = newCache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should initialize reported tracking object correctly', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 100 })
      const stats = newCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should pass options to LRU constructor', () => {
      // Arrange
      const options = { max: 500, ttl: 60000 } as any

      // Act
      new LRUCache(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 500,
          ttl: 60000,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should create MultilayeredCache with itself as a layer', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 100 })

      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([newCache])
    })
  })

  describe('get', () => {
    it('should return value from storage when key exists', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('test-value')

      // Act
      const result = cache.get('test-key')

      // Assert
      expect(result).toBe('test-value')
      expect(mockLRUInstance.get).toHaveBeenCalledWith('test-key')
    })

    it('should increment hits when key exists', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key2')

      // Assert
      expect(cache.getCumulativeStats().hits).toBe(2)
    })

    it('should increment total on every get call', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')

      // Assert
      expect(cache.getCumulativeStats().total).toBe(3)
    })

    it('should not increment hits when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      cache.get('nonexistent-key')

      // Assert
      expect(cache.getCumulativeStats().hits).toBe(0)
      expect(cache.getCumulativeStats().total).toBe(1)
    })

    it('should return undefined when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      const result = cache.get('nonexistent')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle multiple sequential gets', () => {
      // Arrange
      mockLRUInstance.has.mockImplementation((key) => key === 'existing')
      mockLRUInstance.get.mockImplementation((key) => key === 'existing' ? 'value' : undefined)

      // Act
      const result1 = cache.get('existing')
      const result2 = cache.get('missing')
      const result3 = cache.get('existing')

      // Assert
      expect(result1).toBe('value')
      expect(result2).toBeUndefined()
      expect(result3).toBe('value')
      expect(cache.getCumulativeStats().hits).toBe(2)
      expect(cache.getCumulativeStats().total).toBe(3)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer cache get method', async () => {
      // Arrange
      const fetcher = jest.fn()
      mockMultilayeredCacheInstance.get.mockResolvedValue('result')

      // Act
      const result = await cache.getOrSet('key', fetcher)

      // Assert
      expect(mockMultilayeredCacheInstance.get).toHaveBeenCalledWith('key', fetcher)
      expect(result).toBe('result')
    })

    it('should call multilayer get with undefined fetcher when not provided', async () => {
      // Arrange
      mockMultilayeredCacheInstance.get.mockResolvedValue('result')

      // Act
      await cache.getOrSet('key')

      // Assert
      expect(mockMultilayeredCacheInstance.get).toHaveBeenCalledWith('key', undefined)
    })

    it('should return undefined when multilayer returns undefined', async () => {
      // Arrange
      mockMultilayeredCacheInstance.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.getOrSet('key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle async fetcher correctly', async () => {
      // Arrange
      const fetcher = jest.fn().mockResolvedValue({ value: 'async-value' })
      mockMultilayeredCacheInstance.get.mockResolvedValue('async-value')

      // Act
      const result = await cache.getOrSet('async-key', fetcher)

      // Assert
      expect(result).toBe('async-value')
    })
  })

  describe('set', () => {
    it('should call storage set with key and value', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      cache.set('key', 'value')

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value', undefined)
    })

    it('should pass maxAge parameter to storage set', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      cache.set('key', 'value', 5000)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value', 5000)
    })

    it('should return true when set succeeds', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      const result = cache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when set fails', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(false)

      // Act
      const result = cache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle setting multiple different keys', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledTimes(3)
    })

    it('should handle updating existing key with new value', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      cache.set('key', 'value1')
      cache.set('key', 'value2')

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value1', undefined)
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value2', undefined)
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

    it('should check multiple keys independently', () => {
      // Arrange
      mockLRUInstance.has.mockImplementation((key) => key === 'existing')

      // Act
      const result1 = cache.has('existing')
      const result2 = cache.has('missing')

      // Assert
      expect(result1).toBe(true)
      expect(result2).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name when not provided', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')
      cache.get('key1')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('lru-cache')
    })

    it('should return stats with custom name when provided', () => {
      // Arrange
      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hits correctly after get operations', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(3)
    })

    it('should calculate total correctly after get operations', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(3)
    })

    it('should calculate hitRate correctly when total > 0', () => {
      // Arrange
      mockLRUInstance.has.mockImplementation((key) => key !== 'miss')
      mockLRUInstance.get.mockImplementation((key) => key !== 'miss' ? 'value' : undefined)
      cache.get('hit1')
      cache.get('hit2')
      cache.get('miss')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(2 / 3)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should reset reported values after getStats call', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')
      cache.get('key1')
      cache.get('key2')

      // Act
      const stats1 = cache.getStats()
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats2.hits).toBe(0) // Should reset after first call
    })

    it('should track disposedItems correctly', () => {
      // Arrange
      let disposeCallback: (() => void) | undefined
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation((opts: any) => {
        disposeCallback = opts.dispose
        return mockLRUInstance
      })
      const newCache = new LRUCache({ max: 100 })

      // Act
      if (disposeCallback) {
        disposeCallback()
        disposeCallback()
      }
      const stats = newCache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })

    it('should include storage stats in returned object', () => {
      // Arrange
      mockLRUInstance.itemCount = 10
      mockLRUInstance.length = 200
      mockLRUInstance.max = 1000

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.itemCount).toBe(10)
      expect(stats.length).toBe(200)
      expect(stats.max).toBe(1000)
    })

    it('should return all expected properties in stats object', () => {
      // Arrange
      // Act
      const stats = cache.getStats('test')

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('name')
      expect(stats).toHaveProperty('total')
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats object', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')
      cache.get('key')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('total')
    })

    it('should return cumulative hits (not reset like getStats)', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')
      cache.get('key1')
      cache.get('key2')
      cache.getStats() // Reset reported values
      cache.get('key3')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(3) // All hits, not reset
    })

    it('should return cumulative total (not reset like getStats)', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)
      cache.get('key1')
      cache.get('key2')
      cache.getStats() // Reset reported values
      cache.get('key3')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(3) // All totals, not reset
    })

    it('should return cumulative disposedItems', () => {
      // Arrange
      let disposeCallback: (() => void) | undefined
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation((opts: any) => {
        disposeCallback = opts.dispose
        return mockLRUInstance
      })
      const newCache = new LRUCache({ max: 100 })

      // Act
      if (disposeCallback) {
        disposeCallback()
        disposeCallback()
        disposeCallback()
      }
      newCache.getStats() // Reset reported
      if (disposeCallback) {
        disposeCallback()
      }
      const stats = newCache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(4) // All disposed, not reset
    })

    it('should include current storage state in cumulative stats', () => {
      // Arrange
      mockLRUInstance.itemCount = 25
      mockLRUInstance.length = 500
      mockLRUInstance.max = 1000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(25)
      expect(stats.length).toBe(500)
      expect(stats.max).toBe(1000)
    })

    it('should not reset reported values after getCumulativeStats', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')
      cache.get('key1')

      // Act
      const stats1 = cache.getCumulativeStats()
      const stats2 = cache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats2.hits).toBe(1) // Should not reset
    })
  })

  describe('dispose callback', () => {
    it('should increment disposed counter when LRU disposes an item', () => {
      // Arrange
      let disposeCallback: (() => void) | undefined
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation((opts: any) => {
        disposeCallback = opts.dispose
        return mockLRUInstance
      })
      const newCache = new LRUCache({ max: 100 })

      // Act
      if (disposeCallback) {
        disposeCallback()
      }

      // Assert
      expect(newCache.getCumulativeStats().disposedItems).toBe(1)
    })

    it('should handle multiple dispose calls', () => {
      // Arrange
      let disposeCallback: (() => void) | undefined
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation((opts: any) => {
        disposeCallback = opts.dispose
        return mockLRUInstance
      })
      const newCache = new LRUCache({ max: 100 })

      // Act
      if (disposeCallback) {
        for (let i = 0; i < 5; i++) {
          disposeCallback()
        }
      }

      // Assert
      expect(newCache.getCumulativeStats().disposedItems).toBe(5)
    })
  })

  describe('integration scenarios', () => {
    it('should track hit rate across mixed get operations', () => {
      // Arrange
      mockLRUInstance.has.mockImplementation((key) => key === 'hit')
      mockLRUInstance.get.mockImplementation((key) => key === 'hit' ? 'value' : undefined)

      // Act
      cache.get('hit')
      cache.get('hit')
      cache.get('miss')
      cache.get('miss')
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(4)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should handle set and get together', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('stored-value')

      // Act
      const setResult = cache.set('key', 'stored-value')
      const getResult = cache.get('key')
      const hasResult = cache.has('key')

      // Assert
      expect(setResult).toBe(true)
      expect(getResult).toBe('stored-value')
      expect(hasResult).toBe(true)
    })

    it('should accumulate stats across multiple operations', () => {
      // Arrange
      let disposeCallback: (() => void) | undefined
      ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation((opts: any) => {
        disposeCallback = opts.dispose
        return mockLRUInstance
      })
      const newCache = new LRUCache({ max: 100 })
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      newCache.set('key1', 'value1')
      newCache.get('key1')
      newCache.get('key1')
      if (disposeCallback) {
        disposeCallback()
      }
      const cumulativeStats = newCache.getCumulativeStats()

      // Assert
      expect(cumulativeStats.hits).toBe(2)
      expect(cumulativeStats.total).toBe(2)
      expect(cumulativeStats.disposedItems).toBe(1)
    })
  })
})
