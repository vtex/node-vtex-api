import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'
import { WindowedCounters } from './WindowedCounters'
import { FetchResult, LRUStats, CumulativeStats } from './typings'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')
jest.mock('./WindowedCounters')

describe('LRUCache', () => {
  let mockStorage: jest.Mocked<LRU<string, string>>
  let mockMultilayer: jest.Mocked<MultilayeredCache<string, string>>
  let mockCounters: jest.Mocked<WindowedCounters>
  let cache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    mockStorage = {
      get: jest.fn(),
      set: jest.fn().mockReturnValue(true),
      has: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as any

    mockCounters = {
      countDisposed: jest.fn(),
      countHit: jest.fn(),
      countRead: jest.fn(),
      windowed: jest.fn().mockReturnValue({
        disposed: 2,
        hits: 10,
        total: 20,
      }),
      cumulative: jest.fn().mockReturnValue({
        disposed: 5,
        hits: 50,
        total: 100,
      }),
    } as any

    mockMultilayer = {
      get: jest.fn(),
    } as any

    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockStorage)
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => mockMultilayer
    )
    ;(WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mockImplementation(
      () => mockCounters
    )
  })

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      // Arrange
      const options = { max: 500, maxAge: 60000 }

      // Act
      cache = new LRUCache(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 500,
          maxAge: 60000,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should create WindowedCounters instance', () => {
      // Act
      cache = new LRUCache({})

      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })

    it('should create MultilayeredCache with this cache as layer', () => {
      // Act
      cache = new LRUCache({})

      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([cache])
    })

    it('should set dispose handler that counts disposed items', () => {
      // Arrange
      cache = new LRUCache({})
      const disposeHandler = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0]
        .dispose

      // Act
      disposeHandler('key', 'value')

      // Assert
      expect(mockCounters.countDisposed).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new LRUCache({})
    })

    it('should return value from storage', () => {
      // Arrange
      mockStorage.get.mockReturnValue('test-value')
      mockStorage.has.mockReturnValue(true)

      // Act
      const result = cache.get('test-key')

      // Assert
      expect(result).toBe('test-value')
      expect(mockStorage.get).toHaveBeenCalledWith('test-key')
    })

    it('should count hit when key exists', () => {
      // Arrange
      mockStorage.get.mockReturnValue('value')
      mockStorage.has.mockReturnValue(true)

      // Act
      cache.get('key')

      // Assert
      expect(mockCounters.countHit).toHaveBeenCalled()
    })

    it('should not count hit when key does not exist', () => {
      // Arrange
      mockStorage.get.mockReturnValue(undefined)
      mockStorage.has.mockReturnValue(false)

      // Act
      cache.get('key')

      // Assert
      expect(mockCounters.countHit).not.toHaveBeenCalled()
    })

    it('should always count read', () => {
      // Arrange
      mockStorage.get.mockReturnValue('value')
      mockStorage.has.mockReturnValue(true)

      // Act
      cache.get('key')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should count read even on cache miss', () => {
      // Arrange
      mockStorage.get.mockReturnValue(undefined)
      mockStorage.has.mockReturnValue(false)

      // Act
      cache.get('key')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should return undefined for missing key', () => {
      // Arrange
      mockStorage.get.mockReturnValue(undefined)
      mockStorage.has.mockReturnValue(false)

      // Act
      const result = cache.get('missing-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle numeric keys', () => {
      // Arrange
      const numericCache = new LRUCache<number, string>({})
      mockStorage.get.mockReturnValue('numeric-value')
      mockStorage.has.mockReturnValue(true)

      // Act
      const result = numericCache.get(42)

      // Assert
      expect(mockStorage.get).toHaveBeenCalledWith(42)
      expect(result).toBe('numeric-value')
    })

    it('should handle null value in storage', () => {
      // Arrange
      mockStorage.get.mockReturnValue(null as any)
      mockStorage.has.mockReturnValue(true)

      // Act
      const result = cache.get('key')

      // Assert
      expect(result).toBeNull()
      expect(mockCounters.countHit).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new LRUCache({})
    })

    it('should set value in storage', () => {
      // Arrange
      mockStorage.set.mockReturnValue(true)

      // Act
      const result = cache.set('key', 'value')

      // Assert
      expect(mockStorage.set).toHaveBeenCalledWith('key', 'value', undefined)
      expect(result).toBe(true)
    })

    it('should set value with maxAge option', () => {
      // Arrange
      mockStorage.set.mockReturnValue(true)

      // Act
      const result = cache.set('key', 'value', 5000)

      // Assert
      expect(mockStorage.set).toHaveBeenCalledWith('key', 'value', 5000)
      expect(result).toBe(true)
    })

    it('should return false when set operation fails', () => {
      // Arrange
      mockStorage.set.mockReturnValue(false)

      // Act
      const result = cache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle numeric keys', () => {
      // Arrange
      const numericCache = new LRUCache<number, string>({})
      mockStorage.set.mockReturnValue(true)

      // Act
      numericCache.set(123, 'value')

      // Assert
      expect(mockStorage.set).toHaveBeenCalledWith(123, 'value', undefined)
    })

    it('should handle null values', () => {
      // Arrange
      mockStorage.set.mockReturnValue(true)

      // Act
      cache.set('key', null as any)

      // Assert
      expect(mockStorage.set).toHaveBeenCalledWith('key', null, undefined)
    })

    it('should handle zero maxAge', () => {
      // Arrange
      mockStorage.set.mockReturnValue(true)

      // Act
      cache.set('key', 'value', 0)

      // Assert
      expect(mockStorage.set).toHaveBeenCalledWith('key', 'value', 0)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new LRUCache({})
    })

    it('should return true when key exists', () => {
      // Arrange
      mockStorage.has.mockReturnValue(true)

      // Act
      const result = cache.has('key')

      // Assert
      expect(result).toBe(true)
      expect(mockStorage.has).toHaveBeenCalledWith('key')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      mockStorage.has.mockReturnValue(false)

      // Act
      const result = cache.has('key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle numeric keys', () => {
      // Arrange
      const numericCache = new LRUCache<number, string>({})
      mockStorage.has.mockReturnValue(true)

      // Act
      numericCache.has(42)

      // Assert
      expect(mockStorage.has).toHaveBeenCalledWith(42)
    })
  })

  describe('getOrSet', () => {
    beforeEach(() => {
      cache = new LRUCache({})
    })

    it('should call multilayer.get with key and fetcher', async () => {
      // Arrange
      const fetcher = jest.fn()
      mockMultilayer.get.mockResolvedValue('value')

      // Act
      const result = await cache.getOrSet('key', fetcher)

      // Assert
      expect(mockMultilayer.get).toHaveBeenCalledWith('key', fetcher)
      expect(result).toBe('value')
    })

    it('should call multilayer.get without fetcher', async () => {
      // Arrange
      mockMultilayer.get.mockResolvedValue('value')

      // Act
      const result = await cache.getOrSet('key')

      // Assert
      expect(mockMultilayer.get).toHaveBeenCalledWith('key', undefined)
      expect(result).toBe('value')
    })

    it('should return undefined when multilayer returns undefined', async () => {
      // Arrange
      mockMultilayer.get.mockResolvedValue(undefined)

      // Act
      const result = await cache.getOrSet('key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle async errors from multilayer', async () => {
      // Arrange
      const error = new Error('Fetch failed')
      mockMultilayer.get.mockRejectedValue(error)

      // Act & Assert
      await expect(cache.getOrSet('key')).rejects.toThrow('Fetch failed')
    })

    it('should handle numeric keys', async () => {
      // Arrange
      const numericCache = new LRUCache<number, string>({})
      mockMultilayer.get.mockResolvedValue('value')

      // Act
      await numericCache.getOrSet(42)

      // Assert
      expect(mockMultilayer.get).toHaveBeenCalledWith(42, undefined)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      cache = new LRUCache({})
    })

    it('should return stats with default name', () => {
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
      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 8,
        total: 10,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.8)
    })

    it('should set hitRate to undefined when total is 0', () => {
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

    it('should include all storage properties', () => {
      // Arrange
      mockStorage.itemCount = 42
      mockStorage.length = 256
      mockStorage.max = 2048

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.itemCount).toBe(42)
      expect(stats.length).toBe(256)
      expect(stats.max).toBe(2048)
    })

    it('should call counters.windowed', () => {
      // Act
      cache.getStats()

      // Assert
      expect(mockCounters.windowed).toHaveBeenCalled()
    })

    it('should handle zero hits', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 5,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
      expect(stats.hits).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      cache = new LRUCache({})
    })

    it('should return cumulative stats', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hits: 50,
        itemCount: 5,
        length: 100,
        max: 1000,
        total: 100,
      })
    })

    it('should call counters.cumulative', () => {
      // Act
      cache.getCumulativeStats()

      // Assert
      expect(mockCounters.cumulative).toHaveBeenCalled()
    })

    it('should not include name field', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).not.toHaveProperty('name')
    })

    it('should include all required fields', () => {
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

    it('should include storage properties', () => {
      // Arrange
      mockStorage.itemCount = 7
      mockStorage.length = 50
      mockStorage.max = 500

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(7)
      expect(stats.length).toBe(50)
      expect(stats.max).toBe(500)
    })
  })

  describe('integration', () => {
    beforeEach(() => {
      cache = new LRUCache({})
    })

    it('should track multiple operations in stats', () => {
      // Arrange
      mockStorage.get.mockReturnValue('value')
      mockStorage.has.mockReturnValue(true)
      mockStorage.set.mockReturnValue(true)

      // Act
      cache.set('key1', 'value1')
      cache.get('key1')
      cache.get('key2')
      cache.has('key1')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(2)
      expect(mockCounters.countHit).toHaveBeenCalledTimes(1)
    })

    it('should maintain separate stats for different cache instances', () => {
      // Arrange
      const cache1 = new LRUCache({})
      const cache2 = new LRUCache({})

      // Act & Assert
      expect(cache1).not.toBe(cache2)
      expect(WindowedCounters).toHaveBeenCalledTimes(2)
    })
  })
})
