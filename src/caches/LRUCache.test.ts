import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'
import { WindowedCounters } from './WindowedCounters'
import { FetchResult } from './typings'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')
jest.mock('./WindowedCounters')

describe('LRUCache', () => {
  let lruCacheMock: jest.Mocked<LRU<string, any>>
  let multilayerMock: jest.Mocked<MultilayeredCache<string, any>>
  let countersMock: jest.Mocked<WindowedCounters>
  let cache: LRUCache<string, any>

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup WindowedCounters mock
    countersMock = {
      countDisposed: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
      countRead: jest.fn(),
      windowed: jest.fn(() => ({
        disposed: 0,
        hits: 0,
        total: 0,
      })),
      cumulative: jest.fn(() => ({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })),
    } as any
    ;(WindowedCounters as jest.Mock).mockImplementation(() => countersMock)

    // Setup LRU mock
    lruCacheMock = {
      set: jest.fn((key, value, maxAge) => true),
      get: jest.fn(),
      has: jest.fn(() => false),
      itemCount: 0,
      length: 0,
      max: 100,
    } as any
    ;(LRU as jest.Mock).mockImplementation(() => lruCacheMock)

    // Setup MultilayeredCache mock
    multilayerMock = {
      get: jest.fn(),
    } as any
    ;(MultilayeredCache as jest.Mock).mockImplementation(() => multilayerMock)

    // Create instance
    cache = new LRUCache({ max: 100 })
  })

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      // Arrange
      const options = { max: 50 }

      // Act
      const newCache = new LRUCache(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 50,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
      expect(newCache).toBeInstanceOf(LRUCache)
    })

    it('should create WindowedCounters instance', () => {
      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })

    it('should create MultilayeredCache instance with this cache as layer', () => {
      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([expect.any(Object)])
    })

    it('should set up dispose callback that counts disposed items', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback()

      // Assert
      expect(countersMock.countDisposed).toHaveBeenCalled()
    })

    it('should have noDisposeOnSet set to true', () => {
      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          noDisposeOnSet: true,
        })
      )
    })
  })

  describe('get', () => {
    it('should return value from storage when key exists', () => {
      // Arrange
      const testValue = { data: 'test' }
      lruCacheMock.get.mockReturnValue(testValue)
      lruCacheMock.has.mockReturnValue(true)

      // Act
      const result = cache.get('key1')

      // Assert
      expect(result).toBe(testValue)
      expect(lruCacheMock.get).toHaveBeenCalledWith('key1')
    })

    it('should return undefined when key does not exist', () => {
      // Arrange
      lruCacheMock.get.mockReturnValue(undefined)
      lruCacheMock.has.mockReturnValue(false)

      // Act
      const result = cache.get('nonexistent')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should count hit when key exists', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')

      // Assert
      expect(countersMock.countHit).toHaveBeenCalled()
    })

    it('should count miss when key does not exist', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)

      // Act
      cache.get('key1')

      // Assert
      expect(countersMock.countMiss).toHaveBeenCalled()
    })

    it('should always count read', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)

      // Act
      cache.get('key1')

      // Assert
      expect(countersMock.countRead).toHaveBeenCalled()
    })

    it('should count read even on miss', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)
      countersMock.countRead.mockClear()

      // Act
      cache.get('key1')

      // Assert
      expect(countersMock.countRead).toHaveBeenCalled()
    })

    it('should handle null as key', () => {
      // Arrange
      lruCacheMock.get.mockReturnValue(null)
      lruCacheMock.has.mockReturnValue(true)

      // Act
      const result = cache.get(null as any)

      // Assert
      expect(result).toBeNull()
      expect(countersMock.countHit).toHaveBeenCalled()
    })

    it('should handle various data types as values', () => {
      // Arrange
      const testCases = [
        'string value',
        42,
        { complex: 'object' },
        [1, 2, 3],
        true,
      ]

      for (const testValue of testCases) {
        lruCacheMock.get.mockReturnValue(testValue)
        lruCacheMock.has.mockReturnValue(true)

        // Act
        const result = cache.get('key')

        // Assert
        expect(result).toBe(testValue)
      }
    })
  })

  describe('set', () => {
    it('should set value in storage without maxAge', () => {
      // Arrange
      const testValue = { data: 'test' }
      lruCacheMock.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', testValue)

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith('key1', testValue, undefined)
      expect(result).toBe(true)
    })

    it('should set value in storage with maxAge', () => {
      // Arrange
      const testValue = { data: 'test' }
      const maxAge = 5000
      lruCacheMock.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', testValue, maxAge)

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith('key1', testValue, maxAge)
      expect(result).toBe(true)
    })

    it('should return false when storage.set returns false', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(false)

      // Act
      const result = cache.set('key1', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle null key', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      cache.set(null as any, 'value')

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith(null, 'value', undefined)
    })

    it('should handle null value', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      cache.set('key', null as any)

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith('key', null, undefined)
    })

    it('should handle zero maxAge', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      cache.set('key', 'value', 0)

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith('key', 'value', 0)
    })

    it('should handle negative maxAge', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      cache.set('key', 'value', -1)

      // Assert
      expect(lruCacheMock.set).toHaveBeenCalledWith('key', 'value', -1)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)

      // Act
      const result = cache.has('key1')

      // Assert
      expect(result).toBe(true)
      expect(lruCacheMock.has).toHaveBeenCalledWith('key1')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)

      // Act
      const result = cache.has('key1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle null key', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(false)

      // Act
      cache.has(null as any)

      // Assert
      expect(lruCacheMock.has).toHaveBeenCalledWith(null)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer.get with key and fetcher', async () => {
      // Arrange
      const fetcher = jest.fn().mockResolvedValue({ value: 'fetched' })
      multilayerMock.get.mockResolvedValue('result')

      // Act
      const result = await cache.getOrSet('key1', fetcher)

      // Assert
      expect(multilayerMock.get).toHaveBeenCalledWith('key1', fetcher)
      expect(result).toBe('result')
    })

    it('should delegate to multilayer.get without fetcher', async () => {
      // Arrange
      multilayerMock.get.mockResolvedValue('result')

      // Act
      const result = await cache.getOrSet('key1')

      // Assert
      expect(multilayerMock.get).toHaveBeenCalledWith('key1', undefined)
      expect(result).toBe('result')
    })

    it('should return undefined when multilayer returns undefined', async () => {
      // Arrange
      multilayerMock.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.getOrSet('key1')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle null key', async () => {
      // Arrange
      multilayerMock.get.mockResolvedValue('result')

      // Act
      await cache.getOrSet(null as any)

      // Assert
      expect(multilayerMock.get).toHaveBeenCalledWith(null, undefined)
    })

    it('should propagate multilayer errors', async () => {
      // Arrange
      const error = new Error('Multilayer error')
      multilayerMock.get.mockRejectedValue(error)

      // Act & Assert
      await expect(cache.getOrSet('key1')).rejects.toThrow('Multilayer error')
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 5,
        hits: 20,
        total: 30,
      })
      lruCacheMock.itemCount = 10
      lruCacheMock.length = 150
      lruCacheMock.max = 200

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hitRate: 20 / 30,
        hits: 20,
        itemCount: 10,
        length: 150,
        max: 200,
        name: 'lru-cache',
        total: 30,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })
      lruCacheMock.itemCount = 0
      lruCacheMock.length = 0
      lruCacheMock.max = 100

      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })
      lruCacheMock.itemCount = 0
      lruCacheMock.length = 0
      lruCacheMock.max = 100

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should calculate hitRate correctly', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 75,
        total: 100,
      })
      lruCacheMock.itemCount = 0
      lruCacheMock.length = 0
      lruCacheMock.max = 100

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.75)
    })

    it('should handle perfect hit rate', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 100,
        total: 100,
      })
      lruCacheMock.itemCount = 0
      lruCacheMock.length = 0
      lruCacheMock.max = 100

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })

    it('should handle zero hit rate', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 100,
      })
      lruCacheMock.itemCount = 0
      lruCacheMock.length = 0
      lruCacheMock.max = 100

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      countersMock.cumulative.mockReturnValue({
        disposed: 10,
        hits: 150,
        misses: 50,
        total: 200,
      })
      lruCacheMock.itemCount = 25
      lruCacheMock.length = 500
      lruCacheMock.max = 1000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 10,
        hits: 150,
        itemCount: 25,
        length: 500,
        max: 1000,
        misses: 50,
        total: 200,
      })
    })

    it('should handle zero disposed items', () => {
      // Arrange
      countersMock.cumulative.mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })
      lruCacheMock.itemCount = 0
      lruCacheMock.length = 0
      lruCacheMock.max = 100

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(0)
    })

    it('should include all required fields', () => {
      // Arrange
      countersMock.cumulative.mockReturnValue({
        disposed: 5,
        hits: 100,
        misses: 50,
        total: 150,
      })
      lruCacheMock.itemCount = 10
      lruCacheMock.length = 200
      lruCacheMock.max = 500

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
  })

  describe('integration scenarios', () => {
    it('should track multiple reads and hits correctly', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key2')
      cache.get('key1')

      // Assert
      expect(countersMock.countHit).toHaveBeenCalledTimes(3)
      expect(countersMock.countRead).toHaveBeenCalledTimes(3)
      expect(countersMock.countMiss).not.toHaveBeenCalled()
    })

    it('should track mix of hits and misses', () => {
      // Arrange
      lruCacheMock.has.mockReturnValueOnce(true).mockReturnValueOnce(false)
      lruCacheMock.get.mockReturnValue('value')

      // Act
      cache.get('key1')
      cache.get('key2')

      // Assert
      expect(countersMock.countHit).toHaveBeenCalledTimes(1)
      expect(countersMock.countMiss).toHaveBeenCalledTimes(1)
      expect(countersMock.countRead).toHaveBeenCalledTimes(2)
    })

    it('should track dispose when set disposes items', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      lruCacheMock.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value')
      disposeCallback()

      // Assert
      expect(countersMock.countDisposed).toHaveBeenCalled()
    })
  })
})
