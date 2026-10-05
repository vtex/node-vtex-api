import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'
import { WindowedCounters } from './WindowedCounters'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')
jest.mock('./WindowedCounters')

describe('LRUCache', () => {
  let lruCacheMock: jest.Mocked<LRU<any, any>>
  let multilayerMock: jest.Mocked<MultilayeredCache<any, any>>
  let countersMock: jest.Mocked<WindowedCounters>
  let cache: LRUCache<string, string>

  beforeEach(() => {
    // Reset all mocks
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
    multilayerMock = {
      get: jest.fn(),
    } as any

    // Setup WindowedCounters mock
    countersMock = {
      countDisposed: jest.fn(),
      countHit: jest.fn(),
      countRead: jest.fn(),
      windowed: jest.fn(),
      cumulative: jest.fn(),
    } as any

    // Mock constructors
    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => lruCacheMock)
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => multilayerMock
    )
    ;(WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mockImplementation(
      () => countersMock
    )

    // Create instance
    cache = new LRUCache({ max: 1000 })
  })

  describe('constructor', () => {
    it('should initialize with default options', () => {
      // Arrange & Act
      const newCache = new LRUCache({ max: 500 })

      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
      expect(LRU).toHaveBeenCalled()
      expect(MultilayeredCache).toHaveBeenCalled()
    })

    it('should pass options to LRU constructor with dispose and noDisposeOnSet', () => {
      // Act
      new LRUCache({ max: 100, maxSize: 50 })

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 100,
          maxSize: 50,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should invoke dispose callback when LRU disposes items', () => {
      // Act
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()

      // Assert
      expect(countersMock.countDisposed).toHaveBeenCalled()
    })

    it('should initialize MultilayeredCache with this cache instance', () => {
      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([cache])
    })
  })

  describe('get', () => {
    it('should return value from storage when key exists', () => {
      // Arrange
      const testValue = 'test-value'
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
      lruCacheMock.get.mockReturnValue('value')
      lruCacheMock.has.mockReturnValue(true)

      // Act
      cache.get('key1')

      // Assert
      expect(countersMock.countHit).toHaveBeenCalled()
    })

    it('should not count hit when key does not exist', () => {
      // Arrange
      lruCacheMock.get.mockReturnValue(undefined)
      lruCacheMock.has.mockReturnValue(false)
      countersMock.countHit.mockClear()

      // Act
      cache.get('nonexistent')

      // Assert
      expect(countersMock.countHit).not.toHaveBeenCalled()
    })

    it('should always count read regardless of hit or miss', () => {
      // Arrange
      lruCacheMock.get.mockReturnValue('value')
      lruCacheMock.has.mockReturnValue(true)
      countersMock.countRead.mockClear()

      // Act
      cache.get('key1')

      // Assert
      expect(countersMock.countRead).toHaveBeenCalled()
    })

    it('should count read on miss as well', () => {
      // Arrange
      lruCacheMock.get.mockReturnValue(undefined)
      lruCacheMock.has.mockReturnValue(false)
      countersMock.countRead.mockClear()

      // Act
      cache.get('nonexistent')

      // Assert
      expect(countersMock.countRead).toHaveBeenCalled()
    })

    it('should handle null values stored in cache', () => {
      // Arrange
      lruCacheMock.get.mockReturnValue(null)
      lruCacheMock.has.mockReturnValue(true)

      // Act
      const result = cache.get('key1')

      // Assert
      expect(result).toBeNull()
      expect(countersMock.countHit).toHaveBeenCalled()
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer.get with key and fetcher', async () => {
      // Arrange
      const fetcher = jest.fn()
      multilayerMock.get.mockResolvedValue('cached-value')

      // Act
      const result = await cache.getOrSet('key1', fetcher)

      // Assert
      expect(multilayerMock.get).toHaveBeenCalledWith('key1', fetcher)
      expect(result).toBe('cached-value')
    })

    it('should delegate to multilayer.get without fetcher', async () => {
      // Arrange
      multilayerMock.get.mockResolvedValue('value')

      // Act
      const result = await cache.getOrSet('key2')

      // Assert
      expect(multilayerMock.get).toHaveBeenCalledWith('key2', undefined)
      expect(result).toBe('value')
    })

    it('should return undefined when multilayer returns undefined', async () => {
      // Arrange
      multilayerMock.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.getOrSet('missing')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle rejected promise from multilayer', async () => {
      // Arrange
      const error = new Error('Fetch error')
      multilayerMock.get.mockRejectedValue(error)

      // Act & Assert
      await expect(cache.getOrSet('key1')).rejects.toThrow('Fetch error')
    })
  })

  describe('set', () => {
    it('should set value in storage without maxAge', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(true)
      expect(lruCacheMock.set).toHaveBeenCalledWith('key1', 'value1', undefined)
    })

    it('should set value in storage with maxAge', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', 'value1', 5000)

      // Assert
      expect(result).toBe(true)
      expect(lruCacheMock.set).toHaveBeenCalledWith('key1', 'value1', 5000)
    })

    it('should return false when LRU.set returns false', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(false)

      // Act
      const result = cache.set('key1', 'value1')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle null values', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      const result = cache.set('key1', null as any)

      // Assert
      expect(result).toBe(true)
      expect(lruCacheMock.set).toHaveBeenCalledWith('key1', null, undefined)
    })

    it('should handle numeric maxAge values', () => {
      // Arrange
      lruCacheMock.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1', 0)
      cache.set('key2', 'value2', 9999999)

      // Assert
      expect(lruCacheMock.set).toHaveBeenNthCalledWith(1, 'key1', 'value1', 0)
      expect(lruCacheMock.set).toHaveBeenNthCalledWith(2, 'key2', 'value2', 9999999)
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
      const result = cache.has('nonexistent')

      // Assert
      expect(result).toBe(false)
      expect(lruCacheMock.has).toHaveBeenCalledWith('nonexistent')
    })

    it('should handle various key types', () => {
      // Arrange
      lruCacheMock.has.mockReturnValue(true)

      // Act
      cache.has('string-key')
      cache.has(123 as any)
      cache.has(null as any)

      // Assert
      expect(lruCacheMock.has).toHaveBeenCalledWith('string-key')
      expect(lruCacheMock.has).toHaveBeenCalledWith(123)
      expect(lruCacheMock.has).toHaveBeenCalledWith(null)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 10,
        hits: 50,
        total: 100,
      })
      lruCacheMock.itemCount = 25
      lruCacheMock.length = 2500
      lruCacheMock.max = 10000

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 10,
        hitRate: 0.5,
        hits: 50,
        itemCount: 25,
        length: 2500,
        max: 10000,
        name: 'lru-cache',
        total: 100,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 5,
        hits: 30,
        total: 60,
      })

      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate correct hit rate', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 75,
        total: 100,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.75)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return correct stats when total is 1', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 0,
        hits: 1,
        total: 1,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })

    it('should include all storage properties in stats', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 2,
        hits: 15,
        total: 50,
      })
      lruCacheMock.itemCount = 40
      lruCacheMock.length = 4000
      lruCacheMock.max = 50000

      // Act
      const stats = cache.getStats('test-cache')

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('name')
      expect(stats).toHaveProperty('total')
      expect(Object.keys(stats).length).toBe(8)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      countersMock.cumulative.mockReturnValue({
        disposed: 100,
        hits: 500,
        total: 1000,
      })
      lruCacheMock.itemCount = 30
      lruCacheMock.length = 3000
      lruCacheMock.max = 15000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 100,
        hits: 500,
        itemCount: 30,
        length: 3000,
        max: 15000,
        total: 1000,
      })
    })

    it('should not include name in cumulative stats', () => {
      // Arrange
      countersMock.cumulative.mockReturnValue({
        disposed: 0,
        hits: 100,
        total: 200,
      })

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).not.toHaveProperty('name')
      expect(stats).not.toHaveProperty('hitRate')
    })

    it('should return correct cumulative stats when values are large', () => {
      // Arrange
      countersMock.cumulative.mockReturnValue({
        disposed: 999999,
        hits: 5000000,
        total: 10000000,
      })
      lruCacheMock.itemCount = 5000
      lruCacheMock.length = 50000000
      lruCacheMock.max = 100000000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(999999)
      expect(stats.hits).toBe(5000000)
      expect(stats.total).toBe(10000000)
    })

    it('should include all required properties in cumulative stats', () => {
      // Arrange
      countersMock.cumulative.mockReturnValue({
        disposed: 10,
        hits: 50,
        total: 100,
      })

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('total')
      expect(Object.keys(stats).length).toBe(6)
    })
  })

  describe('integration scenarios', () => {
    it('should handle multiple gets with mixed hits and misses', () => {
      // Arrange
      const getSequence = [true, false, true, false, true]
      lruCacheMock.get.mockImplementation(() => 'value')
      lruCacheMock.has.mockImplementation((key) => getSequence[parseInt(key)])

      // Act
      cache.get('0')
      cache.get('1')
      cache.get('2')
      cache.get('3')
      cache.get('4')

      // Assert
      expect(countersMock.countHit).toHaveBeenCalledTimes(3)
      expect(countersMock.countRead).toHaveBeenCalledTimes(5)
    })

    it('should track stats correctly after mixed operations', () => {
      // Arrange
      countersMock.windowed.mockReturnValue({
        disposed: 5,
        hits: 25,
        total: 50,
      })
      lruCacheMock.set.mockReturnValue(true)
      lruCacheMock.itemCount = 20

      // Act
      cache.set('k1', 'v1')
      cache.set('k2', 'v2', 3000)
      const stats = cache.getStats('mixed-ops')

      // Assert
      expect(stats.hitRate).toBe(0.5)
      expect(stats.hits).toBe(25)
      expect(stats.total).toBe(50)
    })
  })
})
