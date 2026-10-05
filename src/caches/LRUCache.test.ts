import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'
import { WindowedCounters } from './WindowedCounters'
import { FetchResult } from './typings'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')
jest.mock('./WindowedCounters')

describe('LRUCache', () => {
  let mockLRUInstance: jest.Mocked<LRU<string, string>>
  let mockMultilayerInstance: jest.Mocked<MultilayeredCache<string, string>>
  let mockCountersInstance: jest.Mocked<WindowedCounters>
  let cache: LRUCache<string, string>

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup LRU mock instance
    mockLRUInstance = {
      get: jest.fn(),
      has: jest.fn(),
      set: jest.fn(),
      dispose: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as unknown as jest.Mocked<LRU<string, string>>

    // Setup MultilayeredCache mock instance
    mockMultilayerInstance = {
      get: jest.fn(),
    } as unknown as jest.Mocked<MultilayeredCache<string, string>>

    // Setup WindowedCounters mock instance
    mockCountersInstance = {
      countDisposed: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
      countRead: jest.fn(),
      windowed: jest.fn().mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      }),
      cumulative: jest.fn().mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      }),
    } as unknown as jest.Mocked<WindowedCounters>

    // Mock constructors
    ;(LRU as jest.Mock).mockReturnValue(mockLRUInstance)
    ;(MultilayeredCache as jest.Mock).mockReturnValue(mockMultilayerInstance)
    ;(WindowedCounters as jest.Mock).mockReturnValue(mockCountersInstance)

    // Create cache instance
    const options: LRU.Options<string, string> = { max: 1000 }
    cache = new LRUCache(options)
  })

  describe('constructor', () => {
    it('should initialize LRU storage with provided options and custom dispose handler', () => {
      // Arrange
      const options: LRU.Options<string, string> = { max: 500, ttl: 60000 }
      jest.clearAllMocks()
      ;(WindowedCounters as jest.Mock).mockReturnValue(mockCountersInstance)
      ;(LRU as jest.Mock).mockReturnValue(mockLRUInstance)
      ;(MultilayeredCache as jest.Mock).mockReturnValue(mockMultilayerInstance)

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

    it('should create WindowedCounters instance', () => {
      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })

    it('should create MultilayeredCache instance with itself as a layer', () => {
      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([cache])
    })

    it('should handle dispose handler when invoked', () => {
      // Arrange
      jest.clearAllMocks()
      ;(WindowedCounters as jest.Mock).mockReturnValue(mockCountersInstance)
      ;(LRU as jest.Mock).mockReturnValue(mockLRUInstance)
      ;(MultilayeredCache as jest.Mock).mockReturnValue(mockMultilayerInstance)

      // Act
      new LRUCache({ max: 100 })
      const disposeHandler = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeHandler()

      // Assert
      expect(mockCountersInstance.countDisposed).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('should return value from storage and count hit when key exists', () => {
      // Arrange
      const key = 'testKey'
      const value = 'testValue'
      mockLRUInstance.get.mockReturnValue(value)
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockLRUInstance.get).toHaveBeenCalledWith(key)
      expect(mockCountersInstance.countHit).toHaveBeenCalled()
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
    })

    it('should return undefined and count miss when key does not exist', () => {
      // Arrange
      const key = 'nonExistentKey'
      mockLRUInstance.get.mockReturnValue(undefined)
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(mockCountersInstance.countMiss).toHaveBeenCalled()
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
    })

    it('should always count read operation', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      cache.get('key')

      // Assert
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
    })

    it('should handle null values correctly', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(null as unknown as string)
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.get('key')

      // Assert
      expect(result).toBeNull()
      expect(mockCountersInstance.countHit).toHaveBeenCalled()
    })

    it('should not double-count when checking has after get', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      mockCountersInstance.countHit.mockClear()
      mockCountersInstance.countMiss.mockClear()

      // Act
      cache.get('key')

      // Assert
      expect(mockCountersInstance.countHit).toHaveBeenCalledTimes(1)
      expect(mockCountersInstance.countMiss).not.toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should store value without maxAge', () => {
      // Arrange
      const key = 'key1'
      const value = 'value1'
      mockLRUInstance.set.mockReturnValue(mockLRUInstance)

      // Act
      cache.set(key, value)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should store value with maxAge', () => {
      // Arrange
      const key = 'key1'
      const value = 'value1'
      const maxAge = 5000
      mockLRUInstance.set.mockReturnValue(mockLRUInstance)

      // Act
      cache.set(key, value, maxAge)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return boolean result from storage set', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any as boolean)

      // Act
      const result = cache.set('key', 'value')

      // Assert
      expect(typeof result).toBe('boolean')
    })

    it('should handle zero maxAge', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(mockLRUInstance)

      // Act
      cache.set('key', 'value', 0)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value', 0)
    })

    it('should handle null values', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(mockLRUInstance)

      // Act
      cache.set('key', null as unknown as string)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', null, undefined)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.has('existingKey')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('existingKey')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.has('nonExistentKey')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('nonExistentKey')
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer cache get method', async () => {
      // Arrange
      const key = 'key1'
      const fetcher = jest.fn()
      const expectedValue = 'value1'
      mockMultilayerInstance.get.mockResolvedValue(expectedValue)

      // Act
      const result = await cache.getOrSet(key, fetcher)

      // Assert
      expect(result).toBe(expectedValue)
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith(key, fetcher)
    })

    it('should handle getOrSet without fetcher', async () => {
      // Arrange
      const key = 'key1'
      mockMultilayerInstance.get.mockResolvedValue('value1')

      // Act
      const result = await cache.getOrSet(key)

      // Assert
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith(key, undefined)
    })

    it('should return undefined from multilayer', async () => {
      // Arrange
      mockMultilayerInstance.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.getOrSet('key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should propagate errors from fetcher', async () => {
      // Arrange
      const error = new Error('Fetch failed')
      mockMultilayerInstance.get.mockRejectedValue(error)

      // Act & Assert
      await expect(cache.getOrSet('key', () => Promise.reject(error))).rejects.toThrow(
        'Fetch failed'
      )
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 2,
        hits: 10,
        total: 20,
      })
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 100
      mockLRUInstance.max = 1000

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 2,
        hitRate: 0.5,
        hits: 10,
        itemCount: 5,
        length: 100,
        max: 1000,
        name: 'lru-cache',
        total: 20,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 1,
        hits: 5,
        total: 10,
      })
      mockLRUInstance.itemCount = 3
      mockLRUInstance.length = 50
      mockLRUInstance.max = 500

      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate correct hitRate', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 25,
        total: 100,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.25)
    })

    it('should return undefined hitRate when total is zero', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should handle perfect hit rate', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 100,
        total: 100,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })

    it('should handle zero hit rate', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 50,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
    })

    it('should include all required fields', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 5,
        hits: 15,
        total: 30,
      })

      // Act
      const stats = cache.getStats()

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
    it('should return cumulative stats', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 10,
        hits: 50,
        misses: 50,
        total: 100,
      })
      mockLRUInstance.itemCount = 8
      mockLRUInstance.length = 200
      mockLRUInstance.max = 2000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 10,
        hits: 50,
        itemCount: 8,
        length: 200,
        max: 2000,
        misses: 50,
        total: 100,
      })
    })

    it('should include all required cumulative fields', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('total')
    })

    it('should handle zero values in cumulative stats', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })
      mockLRUInstance.itemCount = 0
      mockLRUInstance.length = 0
      mockLRUInstance.max = 100

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should track different values for hits vs misses', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 3,
        hits: 70,
        misses: 30,
        total: 100,
      })

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(70)
      expect(stats.misses).toBe(30)
      expect(stats.hits + stats.misses).toBe(stats.total)
    })
  })

  describe('integration', () => {
    it('should handle sequence of operations', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValueOnce('value1')
      mockLRUInstance.has.mockReturnValueOnce(true)
      mockLRUInstance.set.mockReturnValue(mockLRUInstance)
      mockLRUInstance.has.mockReturnValueOnce(false)
      mockLRUInstance.get.mockReturnValueOnce(undefined)

      // Act
      cache.set('key1', 'value1')
      const result1 = cache.get('key1')
      const exists = cache.has('key1')
      const result2 = cache.get('key2')

      // Assert
      expect(result1).toBe('value1')
      expect(exists).toBe(true)
      expect(result2).toBeUndefined()
      expect(mockCountersInstance.countRead).toHaveBeenCalledTimes(2)
      expect(mockCountersInstance.countHit).toHaveBeenCalledTimes(1)
      expect(mockCountersInstance.countMiss).toHaveBeenCalledTimes(1)
    })

    it('should track stats accurately through operations', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.set.mockReturnValue(mockLRUInstance)
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 3,
        total: 5,
      })

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.6)
      expect(stats.hits).toBe(3)
    })
  })
})
