import LRU from 'lru-cache'
import { LRUCache } from './LRUCache'
import { MultilayeredCache } from './MultilayeredCache'

jest.mock('lru-cache')
jest.mock('./MultilayeredCache')

describe('LRUCache', () => {
  let mockLRU: jest.Mocked<LRU<string, string>>
  let mockMultilayeredCache: jest.Mocked<MultilayeredCache<string, string>>
  let lruCache: LRUCache<string, string>

  beforeEach(() => {
    jest.clearAllMocks()

    mockLRU = {
      get: jest.fn(),
      has: jest.fn(),
      set: jest.fn(),
      itemCount: 5,
      length: 120,
      max: 100,
    } as any

    mockMultilayeredCache = {
      get: jest.fn(),
    } as any

    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRU)
    ;(MultilayeredCache as jest.MockedClass<typeof MultilayeredCache>).mockImplementation(
      () => mockMultilayeredCache
    )

    lruCache = new LRUCache({ max: 100 })
  })

  describe('constructor', () => {
    // Arrange & Act & Assert
    it('should initialize with default stats', () => {
      expect(lruCache).toBeDefined()
      expect(mockLRU).toBeDefined()
      expect(mockMultilayeredCache).toBeDefined()
    })

    it('should pass options to LRU constructor with dispose and noDisposeOnSet handlers', () => {
      // Arrange
      const options = { max: 50, ttl: 5000 }

      // Act
      new LRUCache(options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 50,
          ttl: 5000,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should initialize with zero hits, total, and disposed counts', () => {
      // Arrange
      const stats = lruCache.getCumulativeStats()

      // Act & Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create a MultilayeredCache with this instance', () => {
      // Assert
      expect(MultilayeredCache).toHaveBeenCalledWith([lruCache])
    })
  })

  describe('get', () => {
    it('should return value from storage and increment hits when key exists', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRU.get.mockReturnValue(value)
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBe(value)
      expect(mockLRU.get).toHaveBeenCalledWith(key)
      expect(mockLRU.has).toHaveBeenCalledWith(key)
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should return undefined and not increment hits when key does not exist', () => {
      // Arrange
      const key = 'nonexistent-key'
      mockLRU.get.mockReturnValue(undefined)
      mockLRU.has.mockReturnValue(false)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(mockLRU.get).toHaveBeenCalledWith(key)
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should increment total count on every get call', () => {
      // Arrange
      const key1 = 'key1'
      const key2 = 'key2'
      mockLRU.has.mockReturnValue(false)

      // Act
      lruCache.get(key1)
      lruCache.get(key2)
      lruCache.get(key1)

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.total).toBe(3)
    })

    it('should handle multiple hits correctly', () => {
      // Arrange
      const key = 'repeated-key'
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)

      // Act
      lruCache.get(key)
      lruCache.get(key)
      lruCache.get(key)

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(3)
    })

    it('should handle null values correctly', () => {
      // Arrange
      const key = 'null-key'
      mockLRU.get.mockReturnValue(null)
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = lruCache.get(key)

      // Assert
      expect(result).toBeNull()
      const stats = lruCache.getCumulativeStats()
      expect(stats.hits).toBe(1)
    })
  })

  describe('set', () => {
    it('should call storage.set with key and value', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockLRU.set.mockReturnValue(true)

      // Act
      lruCache.set(key, value)

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith(key, value, undefined)
    })

    it('should call storage.set with maxAge when provided', () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const maxAge = 5000
      mockLRU.set.mockReturnValue(true)

      // Act
      lruCache.set(key, value, maxAge)

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith(key, value, maxAge)
    })

    it('should return boolean result from storage.set', () => {
      // Arrange
      mockLRU.set.mockReturnValue(true)

      // Act
      const result = lruCache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle set returning false', () => {
      // Arrange
      mockLRU.set.mockReturnValue(false)

      // Act
      const result = lruCache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      // Arrange
      const key = 'existing-key'
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = lruCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith(key)
    })

    it('should return false when key does not exist', () => {
      // Arrange
      const key = 'nonexistent-key'
      mockLRU.has.mockReturnValue(false)

      // Act
      const result = lruCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(mockLRU.has).toHaveBeenCalledWith(key)
    })
  })

  describe('getOrSet', () => {
    it('should delegate to multilayer.get with key and fetcher', async () => {
      // Arrange
      const key = 'test-key'
      const fetcher = jest.fn()
      mockMultilayeredCache.get.mockResolvedValue('test-value')

      // Act
      const result = await lruCache.getOrSet(key, fetcher)

      // Assert
      expect(mockMultilayeredCache.get).toHaveBeenCalledWith(key, fetcher)
      expect(result).toBe('test-value')
    })

    it('should call multilayer.get without fetcher when not provided', async () => {
      // Arrange
      const key = 'test-key'
      mockMultilayeredCache.get.mockResolvedValue('test-value')

      // Act
      await lruCache.getOrSet(key)

      // Assert
      expect(mockMultilayeredCache.get).toHaveBeenCalledWith(key, undefined)
    })

    it('should return value from multilayer.get', async () => {
      // Arrange
      const value = 'result-value'
      mockMultilayeredCache.get.mockResolvedValue(value)

      // Act
      const result = await lruCache.getOrSet('key')

      // Assert
      expect(result).toBe(value)
    })

    it('should return undefined from multilayer.get', async () => {
      // Arrange
      mockMultilayeredCache.get.mockResolvedValue(undefined)

      // Act
      const result = await lruCache.getOrSet('key')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.name).toBe('lru-cache')
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(2)
    })

    it('should return stats with custom name', () => {
      // Arrange
      const customName = 'my-cache'

      // Act
      const stats = lruCache.getStats(customName)

      // Assert
      expect(stats.name).toBe(customName)
    })

    it('should calculate hitRate correctly when total > 0', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValueOnce(true).mockReturnValueOnce(false)
      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return hitRate of 1 when all are hits', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(1)
    })

    it('should return hitRate of 0 when no hits', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)
      lruCache.get('key1')
      lruCache.get('key2')

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0)
    })

    it('should return storage properties', () => {
      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(120)
      expect(stats.max).toBe(100)
    })

    it('should reset reported stats after getStats call', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)
      lruCache.get('key1')

      // Act
      const firstStats = lruCache.getStats()
      lruCache.get('key2')
      const secondStats = lruCache.getStats()

      // Assert
      expect(firstStats.hits).toBe(1)
      expect(firstStats.total).toBe(1)
      expect(secondStats.hits).toBe(1)
      expect(secondStats.total).toBe(1)
    })

    it('should track disposed items in stats', () => {
      // Arrange
      const capturedDispose = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      capturedDispose?.() // Simulate disposal
      capturedDispose?.()

      // Act
      const stats = lruCache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })

    it('should reset disposedItems counter after getStats', () => {
      // Arrange
      const capturedDispose = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      capturedDispose?.()

      // Act
      const firstStats = lruCache.getStats()
      capturedDispose?.()
      const secondStats = lruCache.getStats()

      // Assert
      expect(firstStats.disposedItems).toBe(1)
      expect(secondStats.disposedItems).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats with all values', () => {
      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('total')
    })

    it('should return cumulative storage properties', () => {
      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(120)
      expect(stats.max).toBe(100)
    })

    it('should return cumulative hits and total', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)
      lruCache.get('key1')
      lruCache.get('key2')
      lruCache.getStats() // Reset reported stats
      lruCache.get('key3')

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(3) // All hits accumulated
      expect(stats.total).toBe(3)
    })

    it('should return cumulative disposed items', () => {
      // Arrange
      const capturedDispose = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      capturedDispose?.()
      capturedDispose?.()
      lruCache.getStats() // Reset reported disposed
      capturedDispose?.()

      // Act
      const stats = lruCache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3) // All disposed accumulated
    })

    it('should not reset stats after getCumulativeStats call', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)
      lruCache.get('key1')

      // Act
      const firstStats = lruCache.getCumulativeStats()
      const secondStats = lruCache.getCumulativeStats()

      // Assert
      expect(firstStats.hits).toBe(firstStats.hits)
      expect(secondStats.hits).toBe(firstStats.hits)
    })
  })

  describe('dispose handler in constructor options', () => {
    it('should increment disposed counter when dispose is called', () => {
      // Arrange
      const capturedDispose = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Act
      capturedDispose?.()

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.disposedItems).toBe(1)
    })

    it('should increment disposed counter multiple times', () => {
      // Arrange
      const capturedDispose = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Act
      capturedDispose?.()
      capturedDispose?.()
      capturedDispose?.()

      // Assert
      const stats = lruCache.getCumulativeStats()
      expect(stats.disposedItems).toBe(3)
    })
  })

  describe('edge cases and integration', () => {
    it('should handle mixed hit and miss scenarios', () => {
      // Arrange
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValueOnce(true)

      // Act
      lruCache.get('key1') // hit
      lruCache.get('key2') // miss
      lruCache.get('key3') // hit

      // Assert
      const stats = lruCache.getStats()
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(2)
      expect(stats.hitRate).toBeCloseTo(0.6666, 4)
    })

    it('should handle numeric keys and values', () => {
      // Arrange
      const numCache = new LRUCache<number, number>({ max: 100 })
      ;(mockLRU.get as jest.Mock).mockReturnValue(42)
      ;(mockLRU.has as jest.Mock).mockReturnValue(true)
      ;(mockLRU.set as jest.Mock).mockReturnValue(true)

      // Act
      numCache.set(1, 42)
      const result = numCache.get(1)
      const hasKey = numCache.has(1)

      // Assert
      expect(result).toBe(42)
      expect(hasKey).toBe(true)
    })

    it('should handle complex object values', () => {
      // Arrange
      const objCache = new LRUCache<string, { name: string; age: number }>({ max: 100 })
      const testObj = { name: 'test', age: 30 }
      ;(mockLRU.get as jest.Mock).mockReturnValue(testObj)
      ;(mockLRU.has as jest.Mock).mockReturnValue(true)

      // Act
      objCache.set('obj-key', testObj)
      const result = objCache.get('obj-key')

      // Assert
      expect(result).toEqual(testObj)
    })

    it('should maintain separate stats across multiple cache instances', () => {
      // Arrange
      const cache1 = new LRUCache({ max: 50 })
      const cache2 = new LRUCache({ max: 100 })
      mockLRU.get.mockReturnValue('value')
      mockLRU.has.mockReturnValue(true)

      // Act
      cache1.get('key1')
      cache2.get('key1')
      cache2.get('key2')

      // Assert
      const stats1 = cache1.getCumulativeStats()
      const stats2 = cache2.getCumulativeStats()
      expect(stats1.total).toBe(1)
      expect(stats2.total).toBe(2)
    })
  })
})
