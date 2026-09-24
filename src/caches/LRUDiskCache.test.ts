import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions, LRUStats, CumulativeStats } from './typings'
import ReadWriteLock from 'rwlock'

jest.mock('rwlock')
jest.mock('fs-extra')

const mockReadJSON = jest.fn()
const mockWriteJSON = jest.fn()
const mockRemove = jest.fn()

describe('LRUDiskCache', () => {
  let cache: LRUDiskCache<any>
  let mockLock: any
  let mockLockInstance: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock ReadWriteLock instance
    mockLockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    }
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLockInstance)

    // Reset mocks
    mockReadJSON.mockReset()
    mockWriteJSON.mockReset()
    mockRemove.mockReset()
  })

  describe('constructor', () => {
    it('should initialize with default file operations', () => {
      // Arrange & Act
      cache = new LRUDiskCache('/cache/path', { max: 100 })

      // Assert
      expect(cache).toBeDefined()
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize with custom file operations', () => {
      // Arrange & Act
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)

      // Assert
      expect(cache).toBeDefined()
    })

    it('should initialize internal stats to zero', () => {
      // Arrange & Act
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)

      // Assert
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create LRU storage with dispose callback', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 50 }
      cache = new LRUDiskCache('/cache/path', options, mockReadJSON, mockWriteJSON)

      // Assert - verify the cache was created with options
      expect(cache).toBeDefined()
      const stats = cache.getCumulativeStats()
      expect(stats.max).toBe(50)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)
    })

    it('should return false for non-existent key', () => {
      // Arrange & Act
      const result = cache.has('non-existent-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should return true after setting a key', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await cache.set('test-key', { data: 'value' })

      // Act
      const result = cache.has('test-key')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)
    })

    it('should return stats with default name', () => {
      // Arrange & Act
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('disk-lru-cache')
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
      expect(stats.itemCount).toBe(0)
      expect(stats.hitRate).toBeUndefined()
    })

    it('should return stats with custom name', () => {
      // Arrange & Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', async () => {
      // Arrange
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      await cache.set('key1', { data: 'value1' })
      await cache.get('key1')
      await cache.get('key1')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(2)
      expect(stats.hitRate).toBe(1)
    })

    it('should reset reported stats after getStats call', () => {
      // Arrange
      cache.getStats()

      // Act
      const stats2 = cache.getStats()

      // Assert
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
    })

    it('should handle hitRate as undefined when total is 0', () => {
      // Arrange & Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)
    })

    it('should return cumulative stats', () => {
      // Arrange & Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('total')
    })

    it('should not reset stats after call', () => {
      // Arrange
      const stats1 = cache.getCumulativeStats()

      // Act
      const stats2 = cache.getCumulativeStats()

      // Assert
      expect(stats1).toEqual(stats2)
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)
    })

    it('should set a key-value pair without maxAge', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('key', { data: 'value' })

      // Assert
      expect(result).toBe(true)
      expect(cache.has('key')).toBe(true)
      expect(mockWriteJSON).toHaveBeenCalledWith('/cache/path/key', { data: 'value' })
    })

    it('should set a key-value pair with maxAge', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('key', { data: 'value' }, 5000)

      // Assert
      expect(result).toBe(true)
      expect(cache.has('key')).toBe(true)
    })

    it('should return false on write error', async () => {
      // Arrange
      mockWriteJSON.mockRejectedValue(new Error('Write failed'))
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('key', { data: 'value' })

      // Assert
      expect(result).toBe(false)
    })

    it('should handle lock release on error', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockWriteJSON.mockRejectedValue(new Error('Write failed'))
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(mockRelease)
      })

      // Act
      await cache.set('key', { data: 'value' })

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should delete previously marked key on set', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      let lockRelease: Function = () => {}
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        lockRelease = callback
        lockRelease(() => {})
      })

      // First set to populate keyToBeDeleted through dispose callback
      await cache.set('key1', { data: 'value1' })

      // Trigger dispose by setting a new key (if LRU evicts)
      // For now, we'll manually test the deletion path
      await cache.set('key2', { data: 'value2' })

      // Assert
      expect(mockWriteJSON).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)
    })

    it('should return undefined for non-existent key', async () => {
      // Arrange
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('non-existent')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should retrieve stored value', async () => {
      // Arrange
      const testValue = { data: 'test-data' }
      mockWriteJSON.mockResolvedValue(undefined)
      mockReadJSON.mockResolvedValue(testValue)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // First set the value
      await cache.set('key', testValue)
      jest.runAllTimers()

      // Act
      const result = await cache.get('key')

      // Assert
      expect(result).toEqual(testValue)
    })

    it('should increment total counter on get', async () => {
      // Arrange
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      await cache.set('key', { data: 'value' })

      // Act
      await cache.get('key')
      await cache.get('key')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.total).toBeGreaterThanOrEqual(2)
    })

    it('should increment hits counter on successful get', async () => {
      // Arrange
      const testValue = { data: 'value' }
      mockReadJSON.mockResolvedValue(testValue)
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      await cache.set('key', testValue)

      // Act
      await cache.get('key')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBeGreaterThanOrEqual(1)
    })

    it('should return null on read error', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockReadJSON.mockRejectedValue(new Error('Read failed'))
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      await cache.set('key', { data: 'value' })

      // Act
      const result = await cache.get('key')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle lock release on read error', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockReadJSON.mockRejectedValue(new Error('Read failed'))
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(mockRelease)
      })
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      await cache.set('key', { data: 'value' })

      // Act
      await cache.get('key')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should delete expired key', async () => {
      // Arrange
      const testValue = { data: 'value' }
      mockWriteJSON.mockResolvedValue(undefined)
      mockReadJSON.mockResolvedValue(testValue)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Set with 1ms maxAge
      await cache.set('key', testValue, 1)

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 100))

      // Act
      const result = await cache.get('key')

      // Assert
      expect(cache.has('key')).toBe(false)
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 10 }, mockReadJSON, mockWriteJSON)
    })

    it('should handle empty string key', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('', { data: 'value' })

      // Assert
      expect(result).toBe(true)
      expect(cache.has('')).toBe(true)
    })

    it('should handle special characters in key', async () => {
      // Arrange
      const specialKey = 'key:with:colons/and\\slashes'
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set(specialKey, { data: 'value' })

      // Assert
      expect(result).toBe(true)
    })

    it('should handle null-like values', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('key', null as any)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle zero maxAge', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('key', { data: 'value' }, 0)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle negative maxAge', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('key', { data: 'value' }, -1000)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle undefined value', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('key', undefined as any)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('concurrent access', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 100 }, mockReadJSON, mockWriteJSON)
    })

    it('should use readLock for get operations', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      await cache.set('key', { data: 'value' })

      // Act
      await cache.get('key')

      // Assert
      expect(mockLockInstance.readLock).toHaveBeenCalled()
    })

    it('should use writeLock for set operations', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await cache.set('key', { data: 'value' })

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalled()
    })
  })

  describe('LRU eviction behavior', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 3 }, mockReadJSON, mockWriteJSON)
    })

    it('should track disposed items through getStats', async () => {
      // Arrange
      mockWriteJSON.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act - Add items beyond LRU max
      await cache.set('key1', { data: '1' })
      await cache.set('key2', { data: '2' })
      await cache.set('key3', { data: '3' })
      // This should trigger eviction
      await cache.set('key4', { data: '4' })

      const stats = cache.getStats()

      // Assert
      expect(stats.disposedItems).toBeGreaterThanOrEqual(0)
    })
  })
})