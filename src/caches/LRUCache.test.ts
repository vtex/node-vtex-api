import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'
import { WindowedCounters } from './WindowedCounters'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')
jest.mock('./WindowedCounters')

describe('LRUCache', () => {
  let mockLRUInstance: jest.Mocked<LRU<any, any>>
  let mockMultilayerInstance: jest.Mocked<MultilayeredCache<any, any>>
  let mockCountersInstance: jest.Mocked<WindowedCounters>
  let lruCache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock LRU instance
    mockLRUInstance = {
      get: jest.fn(),
      has: jest.fn(),
      set: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as any

    // Mock MultilayeredCache instance
    mockMultilayerInstance = {
      get: jest.fn(),
    } as any

    // Mock WindowedCounters instance
    mockCountersInstance = {
      countDisposed: jest.fn(),
      countHit: jest.fn(),
      countRead: jest.fn(),
      windowed: jest.fn(),
      cumulative: jest.fn(),
    } as any

    // Setup constructor mocks
    ;(LRU as jest.Mock).mockImplementation(() => mockLRUInstance)
    ;(MultilayeredCache as jest.Mock).mockImplementation(() => mockMultilayerInstance)
    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockCountersInstance)

    lruCache = new LRUCache<string, string>({
      max: 1000,
    })
  })

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      // Arrange
      const options = { max: 500 }

      // Act
      new LRUCache(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 500,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should create WindowedCounters instance', () => {
      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })

    it('should create MultilayeredCache instance with self as layer', () => {
      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([expect.any(LRUCache)])
    })

    it('should set up dispose callback that calls countDisposed', () => {
      // Arrange
      const options = { max: 100 }
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback()

      // Assert
      expect(mockCountersInstance.countDisposed).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('should return value when key exists', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRUInstance.get.mockReturnValue(value)
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockLRUInstance.get).toHaveBeenCalledWith(key)
    })

    it('should return undefined when key does not exist', () => {
      // Arrange
      const key = 'non-existent-key'
      mockLRUInstance.get.mockReturnValue(undefined)
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should count a hit when key exists', () => {
      // Arrange
      const key = 'test-key'
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      lruCache.get(key)

      // Assert
      expect(mockCountersInstance.countHit).toHaveBeenCalled()
    })

    it('should not count a hit when key does not exist', () => {
      // Arrange
      const key = 'non-existent-key'
      mockLRUInstance.get.mockReturnValue(undefined)
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      lruCache.get(key)

      // Assert
      expect(mockCountersInstance.countHit).not.toHaveBeenCalled()
    })

    it('should always count a read', () => {
      // Arrange
      const key = 'test-key'
      mockLRUInstance.get.mockReturnValue('value')
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      lruCache.get(key)

      // Assert
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
    })

    it('should count read even when key does not exist', () => {
      // Arrange
      const key = 'non-existent-key'
      mockLRUInstance.get.mockReturnValue(undefined)
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      lruCache.get(key)

      // Assert
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
    })

    it('should handle null key', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = lruCache.get(null as any)

      // Assert
      expect(result).toBeUndefined()
      expect(mockLRUInstance.get).toHaveBeenCalledWith(null)
    })

    it('should handle empty string key', () => {
      // Arrange
      const key = ''
      const value = 'test-value'
      mockLRUInstance.get.mockReturnValue(value)
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockLRUInstance.get).toHaveBeenCalledWith(key)
    })
  })

  describe('set', () => {
    it('should set key-value pair without maxAge', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any)

      // Act
      lruCache.set(key, value)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should set key-value pair with maxAge', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 5000
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any)

      // Act
      lruCache.set(key, value, maxAge)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return boolean result from storage', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any)

      // Act
      const result = lruCache.set(key, value)

      // Assert
      expect(typeof result).toBe('object')
    })

    it('should handle null value', () => {
      // Arrange
      const key = 'test-key'
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any)

      // Act
      lruCache.set(key, null as any)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, null, undefined)
    })

    it('should handle empty string value', () => {
      // Arrange
      const key = 'test-key'
      const value = ''
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any)

      // Act
      lruCache.set(key, value)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should handle zero maxAge', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 0
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any)

      // Act
      lruCache.set(key, value, maxAge)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(key, value, maxAge)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      const key = 'test-key'
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = lruCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith(key)
    })

    it('should return false when key does not exist', () => {
      // Arrange
      const key = 'non-existent-key'
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = lruCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith(key)
    })

    it('should handle null key', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = lruCache.has(null as any)

      // Assert
      expect(mockLRUInstance.has).toHaveBeenCalledWith(null)
    })

    it('should handle empty string key', () => {
      // Arrange
      const key = ''
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = lruCache.has(key)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer cache get method', async () => {
      // Arrange
      const key = 'test-key'
      const fetcher = jest.fn()
      const value = 'test-value'
      mockMultilayerInstance.get.mockResolvedValue(value)

      // Act
      const result = await lruCache.getOrSet(key, fetcher)

      // Assert
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith(key, fetcher)
      expect(result).toBe(value)
    })

    it('should work without fetcher', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockMultilayerInstance.get.mockResolvedValue(value)

      // Act
      const result = await lruCache.getOrSet(key)

      // Assert
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith(key, undefined)
      expect(result).toBe(value)
    })

    it('should handle promise rejection', async () => {
      // Arrange
      const key = 'test-key'
      const error = new Error('fetch failed')
      mockMultilayerInstance.get.mockRejectedValue(error)

      // Act & Assert
      await expect(lruCache.getOrSet(key)).rejects.toThrow('fetch failed')
    })

    it('should return undefined from multilayer', async () => {
      // Arrange
      const key = 'test-key'
      mockMultilayerInstance.get.mockResolvedValue(undefined)

      // Act
      const result = await lruCache.getOrSet(key)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 10,
        hits: 50,
        total: 100,
      })
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 200
      mockLRUInstance.max = 1000

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 10,
        hitRate: 0.5,
        hits: 50,
        itemCount: 5,
        length: 200,
        max: 1000,
        name: 'lru-cache',
        total: 100,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      const customName = 'my-cache'
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 5,
        hits: 30,
        total: 60,
      })
      mockLRUInstance.itemCount = 3
      mockLRUInstance.length = 150
      mockLRUInstance.max = 500

      // Act
      const stats = lruCache.getStats(customName)

      // Assert
      expect(stats.name).toBe(customName)
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 75,
        total: 100,
      })

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.75)
    })

    it('should return undefined hit rate when total is zero', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return zero hit rate when no hits', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 50,
      })

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
    })

    it('should call windowed method on counters', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      lruCache.getStats()

      // Assert
      expect(mockCountersInstance.windowed).toHaveBeenCalled()
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 100,
        hits: 500,
        total: 1000,
      })
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 200
      mockLRUInstance.max = 1000

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 100,
        hits: 500,
        itemCount: 5,
        length: 200,
        max: 1000,
        total: 1000,
      })
    })

    it('should not include hitRate in cumulative stats', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 50,
        hits: 200,
        total: 500,
      })

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats).not.toHaveProperty('hitRate')
    })

    it('should not include name in cumulative stats', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats).not.toHaveProperty('name')
    })

    it('should call cumulative method on counters', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      lruCache.getCumulativeStats()

      // Assert
      expect(mockCountersInstance.cumulative).toHaveBeenCalled()
    })

    it('should handle large cumulative values', () => {
      // Arrange
      const largeNumber = Number.MAX_SAFE_INTEGER
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: largeNumber,
        hits: largeNumber,
        total: largeNumber,
      })

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(largeNumber)
      expect(stats.hits).toBe(largeNumber)
      expect(stats.total).toBe(largeNumber)
    })
  })

  describe('integration scenarios', () => {
    it('should track multiple get operations', () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue('value1')
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      lruCache.get('key1')
      lruCache.get('key2')
      lruCache.get('key3')

      // Assert
      expect(mockCountersInstance.countRead).toHaveBeenCalledTimes(3)
      expect(mockCountersInstance.countHit).toHaveBeenCalledTimes(3)
    })

    it('should track hits and misses together', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValueOnce(true).mockReturnValueOnce(false)
      mockLRUInstance.get.mockReturnValueOnce('value1').mockReturnValueOnce(undefined)

      // Act
      lruCache.get('existing-key')
      lruCache.get('missing-key')

      // Assert
      expect(mockCountersInstance.countHit).toHaveBeenCalledTimes(1)
      expect(mockCountersInstance.countRead).toHaveBeenCalledTimes(2)
    })

    it('should properly set and retrieve values', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(mockLRUInstance as any)
      mockLRUInstance.get.mockReturnValue('stored-value')
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      lruCache.set('test-key', 'stored-value')
      const retrieved = lruCache.get('test-key')

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalled()
      expect(retrieved).toBe('stored-value')
    })
  })
})
