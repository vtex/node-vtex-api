import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'
import { WindowedCounters } from './WindowedCounters'
import { FetchResult } from './typings'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')
jest.mock('./WindowedCounters')

describe('LRUCache', () => {
  let mockLRU: jest.Mocked<LRU<any, any>>
  let mockMultilayer: jest.Mocked<MultilayeredCache<any, any>>
  let mockCounters: jest.Mocked<WindowedCounters>
  let cache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    mockLRU = {
      get: jest.fn(),
      set: jest.fn().mockReturnValue(true),
      has: jest.fn().mockReturnValue(false),
      itemCount: 5,
      length: 100,
      max: 1000,
      dispose: jest.fn(),
    } as any

    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRU)

    mockCounters = {
      countHit: jest.fn(),
      countMiss: jest.fn(),
      countRead: jest.fn(),
      countDisposed: jest.fn(),
      windowed: jest.fn().mockReturnValue({
        disposed: 2,
        hits: 10,
        total: 20,
      }),
      cumulative: jest.fn().mockReturnValue({
        disposed: 5,
        hits: 50,
        misses: 30,
        total: 80,
      }),
    } as any

    ;(WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mockImplementation(
      () => mockCounters
    )

    mockMultilayer = {
      get: jest.fn(),
    } as any

    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => mockMultilayer
    )

    cache = new LRUCache<string, string>({
      max: 100,
    })
  })

  describe('constructor', () => {
    it('should initialize with provided LRU options', () => {
      // Arrange
      const options = { max: 50 }

      // Act
      new LRUCache(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 50,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should initialize WindowedCounters', () => {
      // Arrange & Act
      new LRUCache({ max: 100 })

      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })

    it('should initialize MultilayeredCache with itself', () => {
      // Arrange & Act
      const instance = new LRUCache({ max: 100 })

      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([instance])
    })

    it('should set up dispose callback', () => {
      // Arrange
      const options = { max: 100 }
      new LRUCache(options)

      // Act
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()

      // Assert
      expect(mockCounters.countDisposed).toHaveBeenCalled()
    })

    it('should set noDisposeOnSet to true', () => {
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

  describe('get', () => {
    it('should return value when key exists', () => {
      // Arrange
      const testValue = 'testValue'
      mockLRU.get.mockReturnValue(testValue)
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = cache.get('key1')

      // Assert
      expect(result).toBe(testValue)
      expect(mockLRU.get).toHaveBeenCalledWith('key1')
    })

    it('should return undefined when key does not exist', () => {
      // Arrange
      mockLRU.get.mockReturnValue(undefined)
      mockLRU.has.mockReturnValue(false)

      // Act
      const result = cache.get('nonexistent')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should count hit when key exists', () => {
      // Arrange
      mockLRU.has.mockReturnValue(true)
      mockLRU.get.mockReturnValue('value')

      // Act
      cache.get('key1')

      // Assert
      expect(mockCounters.countHit).toHaveBeenCalled()
    })

    it('should count miss when key does not exist', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)
      mockLRU.get.mockReturnValue(undefined)

      // Act
      cache.get('key1')

      // Assert
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })

    it('should always count read', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)
      mockLRU.get.mockReturnValue(undefined)

      // Act
      cache.get('key1')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should call countRead even on hit', () => {
      // Arrange
      mockLRU.has.mockReturnValue(true)
      mockLRU.get.mockReturnValue('value')

      // Act
      cache.get('key1')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should not count hit when has returns false', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)
      mockLRU.get.mockReturnValue('value')

      // Act
      cache.get('key1')

      // Assert
      expect(mockCounters.countHit).not.toHaveBeenCalled()
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })

    it('should handle multiple consecutive gets', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value1')
      mockLRU.has.mockReturnValue(true)

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(3)
      expect(mockCounters.countHit).toHaveBeenCalledTimes(3)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer.get', async () => {
      // Arrange
      const key = 'testKey'
      const fetcher = jest.fn()
      mockMultilayer.get.mockResolvedValue('cachedValue')

      // Act
      const result = await cache.getOrSet(key, fetcher)

      // Assert
      expect(mockMultilayer.get).toHaveBeenCalledWith(key, fetcher)
      expect(result).toBe('cachedValue')
    })

    it('should call multilayer.get without fetcher', async () => {
      // Arrange
      const key = 'testKey'
      mockMultilayer.get.mockResolvedValue('value')

      // Act
      await cache.getOrSet(key)

      // Assert
      expect(mockMultilayer.get).toHaveBeenCalledWith(key, undefined)
    })

    it('should return void when multilayer returns void', async () => {
      // Arrange
      mockMultilayer.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.getOrSet('key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle rejected promise from fetcher', async () => {
      // Arrange
      const error = new Error('Fetch failed')
      mockMultilayer.get.mockRejectedValue(error)

      // Act & Assert
      await expect(cache.getOrSet('key')).rejects.toThrow('Fetch failed')
    })
  })

  describe('set', () => {
    it('should set value with key', () => {
      // Arrange
      mockLRU.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', 'value1')

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith('key1', 'value1', undefined)
      expect(result).toBe(true)
    })

    it('should set value with maxAge option', () => {
      // Arrange
      mockLRU.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', 'value1', 5000)

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith('key1', 'value1', 5000)
      expect(result).toBe(true)
    })

    it('should return boolean from storage.set', () => {
      // Arrange
      mockLRU.set.mockReturnValue(false)

      // Act
      const result = cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle setting with 0 as maxAge', () => {
      // Arrange
      mockLRU.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1', 0)

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith('key1', 'value1', 0)
    })

    it('should handle setting with negative maxAge', () => {
      // Arrange
      mockLRU.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1', -1)

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith('key1', 'value1', -1)
    })

    it('should handle multiple consecutive sets', () => {
      // Arrange
      mockLRU.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Assert
      expect(mockLRU.set).toHaveBeenCalledTimes(3)
    })

    it('should allow overwriting existing key', () => {
      // Arrange
      mockLRU.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')

      // Assert
      expect(mockLRU.set).toHaveBeenCalledTimes(2)
      expect(mockLRU.set).toHaveBeenLastCalledWith('key1', 'value2', undefined)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = cache.has('key1')

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith('key1')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)

      // Act
      const result = cache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should check multiple keys independently', () => {
      // Arrange
      mockLRU.has
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      // Act
      const result1 = cache.has('key1')
      const result2 = cache.has('key2')
      const result3 = cache.has('key3')

      // Assert
      expect(result1).toBe(true)
      expect(result2).toBe(false)
      expect(result3).toBe(true)
    })
  })

  describe('getStats', () => {
    it('should return windowed stats with default name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 2,
        hits: 10,
        total: 20,
      })
      mockLRU.itemCount = 5
      mockLRU.length = 100
      mockLRU.max = 1000

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
      mockCounters.windowed.mockReturnValue({
        disposed: 2,
        hits: 10,
        total: 20,
      })

      // Act
      const stats = cache.getStats('customCache')

      // Assert
      expect(stats.name).toBe('customCache')
    })

    it('should calculate hitRate correctly', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 25,
        total: 100,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.25)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return stats with all storage properties', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 3,
        hits: 15,
        total: 30,
      })
      mockLRU.itemCount = 10
      mockLRU.length = 200
      mockLRU.max = 500

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.itemCount).toBe(10)
      expect(stats.length).toBe(200)
      expect(stats.max).toBe(500)
    })

    it('should call windowed counters', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      cache.getStats()

      // Assert
      expect(mockCounters.windowed).toHaveBeenCalled()
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({
        disposed: 5,
        hits: 50,
        misses: 30,
        total: 80,
      })
      mockLRU.itemCount = 5
      mockLRU.length = 100
      mockLRU.max = 1000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hits: 50,
        itemCount: 5,
        length: 100,
        max: 1000,
        misses: 30,
        total: 80,
      })
    })

    it('should call cumulative counters', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })

      // Act
      cache.getCumulativeStats()

      // Assert
      expect(mockCounters.cumulative).toHaveBeenCalled()
    })

    it('should include misses in cumulative stats', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({
        disposed: 2,
        hits: 100,
        misses: 50,
        total: 150,
      })

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.misses).toBe(50)
    })

    it('should return stats with all storage properties', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({
        disposed: 10,
        hits: 200,
        misses: 100,
        total: 300,
      })
      mockLRU.itemCount = 20
      mockLRU.length = 400
      mockLRU.max = 2000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(20)
      expect(stats.length).toBe(400)
      expect(stats.max).toBe(2000)
      expect(stats.disposedItems).toBe(10)
    })
  })

  describe('integration scenarios', () => {
    it('should track stats correctly across get and set operations', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)
      mockLRU.set.mockReturnValue(true)
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 2,
        total: 3,
      })

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.set('key3', 'value3')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(2)
      expect(mockCounters.countHit).toHaveBeenCalledTimes(2)
    })

    it('should handle mixed hit and miss scenarios', () => {
      // Arrange
      mockLRU.get
        .mockReturnValueOnce('value1')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('value3')
      mockLRU.has
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key3')

      // Assert
      expect(mockCounters.countHit).toHaveBeenCalledTimes(2)
      expect(mockCounters.countMiss).toHaveBeenCalledTimes(1)
      expect(mockCounters.countRead).toHaveBeenCalledTimes(3)
    })
  })
})
