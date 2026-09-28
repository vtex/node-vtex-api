import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')

describe('LRUCache', () => {
  let mockLRUInstance: jest.Mocked<LRU<string, string>>
  let mockMultilayerInstance: jest.Mocked<MultilayeredCache<string, string>>
  let lruCache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock LRU instance
    mockLRUInstance = {
      get: jest.fn(),
      set: jest.fn().mockReturnValue(true),
      has: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as any

    // Mock LRU constructor
    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRUInstance)

    // Mock MultilayeredCache instance
    mockMultilayerInstance = {
      get: jest.fn(),
    } as any

    // Mock MultilayeredCache constructor
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => mockMultilayerInstance
    )
  })

  describe('constructor', () => {
    it('should initialize with default values', () => {
      // Arrange & Act
      lruCache = new LRUCache({ max: 100 })

      // Assert
      expect(lruCache).toBeInstanceOf(LRUCache)
    })

    it('should create LRU storage with provided options', () => {
      // Arrange
      const options = { max: 500, ttl: 60000 }

      // Act
      lruCache = new LRUCache(options)

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

    it('should initialize counters to zero', () => {
      // Arrange & Act
      lruCache = new LRUCache({ max: 100 })

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create a MultilayeredCache with itself as a layer', () => {
      // Arrange & Act
      lruCache = new LRUCache({ max: 100 })

      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([lruCache])
    })

    it('should set dispose callback on LRU storage', () => {
      // Arrange
      lruCache = new LRUCache({ max: 100 })
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Act
      disposeCallback()
      disposeCallback()

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.disposedItems).toBe(2)
    })
  })

  describe('get method', () => {
    beforeEach(() => {
      lruCache = new LRUCache({ max: 100 })
    })

    it('should return value when key exists', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('test-value')

      // Act
      const result = lruCache.get('test-key')

      // Assert
      expect(result).toBe('test-value')
      expect(mockLRUInstance.get).toHaveBeenCalledWith('test-key')
    })

    it('should increment hits when key exists', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      mockLRUInstance.get.mockReturnValue('value')

      // Act
      lruCache.get('key')
      lruCache.get('key')

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(2)
    })

    it('should increment total on every get call', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      lruCache.get('key1')
      lruCache.get('key2')
      lruCache.get('key3')

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.total).toBe(3)
    })

    it('should return undefined when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      const result = lruCache.get('nonexistent')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should not increment hits when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      lruCache.get('key')

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should handle multiple gets with mixed hits and misses', () => {
      // Arrange
      mockLRUInstance.has.mockImplementation((key) => key === 'existing')

      // Act
      lruCache.get('existing')
      lruCache.get('missing')
      lruCache.get('existing')
      lruCache.get('missing')

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(4)
    })
  })

  describe('set method', () => {
    beforeEach(() => {
      lruCache = new LRUCache({ max: 100 })
    })

    it('should set value in storage', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      const result = lruCache.set('key', 'value')

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value', undefined)
      expect(result).toBe(true)
    })

    it('should set value with maxAge parameter', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      const result = lruCache.set('key', 'value', 5000)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value', 5000)
      expect(result).toBe(true)
    })

    it('should return true when set succeeds', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      const result = lruCache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when set fails', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(false)

      // Act
      const result = lruCache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle different value types', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      lruCache.set('string', 'value')
      lruCache.set('number', 42 as any)
      lruCache.set('object', { data: 'test' } as any)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledTimes(3)
    })

    it('should handle zero maxAge', () => {
      // Arrange
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      lruCache.set('key', 'value', 0)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('key', 'value', 0)
    })
  })

  describe('has method', () => {
    beforeEach(() => {
      lruCache = new LRUCache({ max: 100 })
    })

    it('should return true when key exists', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = lruCache.has('key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('key')
    })

    it('should return false when key does not exist', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = lruCache.has('key')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getOrSet method', () => {
    beforeEach(() => {
      lruCache = new LRUCache({ max: 100 })
    })

    it('should delegate to multilayer cache', async () => {
      // Arrange
      const fetcher = jest.fn()
      mockMultilayerInstance.get.mockResolvedValue('result')

      // Act
      const result = await lruCache.getOrSet('key', fetcher)

      // Assert
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith('key', fetcher)
      expect(result).toBe('result')
    })

    it('should call multilayer get without fetcher', async () => {
      // Arrange
      mockMultilayerInstance.get.mockResolvedValue('result')

      // Act
      await lruCache.getOrSet('key')

      // Assert
      expect(mockMultilayerInstance.get).toHaveBeenCalledWith('key', undefined)
    })

    it('should return undefined when multilayer returns undefined', async () => {
      // Arrange
      mockMultilayerInstance.get.mockResolvedValue(undefined)

      // Act
      const result = await lruCache.getOrSet('key')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getStats method', () => {
    beforeEach(() => {
      lruCache = new LRUCache({ max: 100 })
    })

    it('should return stats with default name', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 1000
      mockLRUInstance.has.mockReturnValue(true)

      lruCache.get('key1')
      lruCache.get('key2')
      lruCache.get('key3')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.name).toBe('lru-cache')
      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(3)
      expect(stats.hitRate).toBe(1)
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(50)
      expect(stats.max).toBe(1000)
    })

    it('should return stats with custom name', () => {
      // Arrange
      // Act
      const stats = lruCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should reset reported values after getStats', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats1 = lruCache.getStats()
      const stats2 = lruCache.getStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats1.total).toBe(2)
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
    })

    it('should calculate hitRate correctly', () => {
      // Arrange
      mockLRUInstance.has.mockImplementation((key) => key === 'hit')
      lruCache.get('hit')
      lruCache.get('miss')
      lruCache.get('hit')
      lruCache.get('miss')
      lruCache.get('miss')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.4) // 2 hits out of 5 total
    })

    it('should return undefined hitRate when total is zero', () => {
      // Arrange
      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should include disposedItems in stats', () => {
      // Arrange
      lruCache = new LRUCache({ max: 100 })
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()
      disposeCallback()

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })

    it('should reset disposedItems count after getStats', () => {
      // Arrange
      lruCache = new LRUCache({ max: 100 })
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()
      disposeCallback()

      // Act
      const stats1 = lruCache.getStats()
      const stats2 = lruCache.getStats()

      // Assert
      expect(stats1.disposedItems).toBe(2)
      expect(stats2.disposedItems).toBe(0)
    })
  })

  describe('getCumulativeStats method', () => {
    beforeEach(() => {
      lruCache = new LRUCache({ max: 100 })
    })

    it('should return cumulative stats without resetting', () => {
      // Arrange
      mockLRUInstance.itemCount = 10
      mockLRUInstance.length = 100
      mockLRUInstance.max = 1000
      mockLRUInstance.has.mockReturnValue(true)

      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats1 = lruCache.getCumulativeStats()
      const stats2 = lruCache.getCumulativeStats()

      // Assert
      expect(stats1).toEqual(stats2)
      expect(stats1.hits).toBe(2)
      expect(stats1.total).toBe(2)
    })

    it('should return all storage properties', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 1000

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 0,
        hits: 0,
        itemCount: 5,
        length: 50,
        max: 1000,
        total: 0,
      })
    })

    it('should reflect cumulative disposed items', () => {
      // Arrange
      lruCache = new LRUCache({ max: 100 })
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback()
      disposeCallback()
      disposeCallback()

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      lruCache = new LRUCache({ max: 100 })
    })

    it('should track stats correctly across multiple operations', () => {
      // Arrange
      mockLRUInstance.has.mockImplementation((key) => key === 'key1' || key === 'key2')
      mockLRUInstance.get.mockImplementation((key) => (key === 'key1' || key === 'key2' ? `value-${key}` : undefined))
      mockLRUInstance.set.mockReturnValue(true)

      // Act
      lruCache.get('key1') // hit
      lruCache.get('missing') // miss
      lruCache.set('key3', 'value3')
      lruCache.get('key2') // hit
      lruCache.get('missing') // miss

      // Assert
      const stats = lruCache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(4)
      expect(stats.hitRate).toBe(0.5)
    })

    it('should handle consecutive getStats calls correctly', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)

      lruCache.get('key')
      lruCache.get('key')

      // Act
      const stats1 = lruCache.getStats()
      lruCache.get('key')
      const stats2 = lruCache.getStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats1.total).toBe(2)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })

    it('should maintain separate stats and cumulative stats', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      lruCache.get('key')
      lruCache.get('key')

      // Act
      const stats1 = lruCache.getStats()
      const cumulative1 = lruCache.getCumulativeStats()
      lruCache.get('key')
      const stats2 = lruCache.getStats()
      const cumulative2 = lruCache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(cumulative1.hits).toBe(2)
      expect(stats2.hits).toBe(1)
      expect(cumulative2.hits).toBe(3)
    })
  })
})
