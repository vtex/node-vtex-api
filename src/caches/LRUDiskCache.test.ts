import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import LRU from 'lru-cache'
import ReadWriteLock from 'rwlock'

jest.mock('lru-cache')
jest.mock('rwlock')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLRUInstance: any
  let mockLockInstance: any
  let cache: LRUDiskCache<string>
  const cachePath = '/test/cache'
  const options: LRUDiskCacheOptions = { max: 100 }

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup mock file operations
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    // Setup mock LRU instance
    mockLRUInstance = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 0,
      length: 0,
      max: 100,
    }

    // Setup mock lock instance
    mockLockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    }

    // Mock LRU constructor
    ;(LRU as jest.Mock).mockImplementation(() => mockLRUInstance)

    // Mock ReadWriteLock constructor
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLockInstance)

    // Create cache instance with mocked dependencies
    cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      // Arrange & Act
      const newCache = new LRUDiskCache(cachePath, options)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 100,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize with custom read and write functions', () => {
      // Arrange
      const customRead = jest.fn()
      const customWrite = jest.fn()

      // Act
      const newCache = new LRUDiskCache(cachePath, options, customRead, customWrite)

      // Assert
      expect(newCache).toBeInstanceOf(LRUDiskCache)
    })

    it('should call dispose callback when LRU evicts a key', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback('evicted-key')

      // Assert
      expect(cache['keyToBeDeleted']).toBe('evicted-key')
      expect(cache['disposed']).toBe(1)
    })

    it('should initialize stats counters to zero', () => {
      // Assert
      expect(cache['hits']).toBe(0)
      expect(cache['total']).toBe(0)
      expect(cache['disposed']).toBe(0)
      expect(cache['keyToBeDeleted']).toBe('')
    })
  })

  describe('has', () => {
    it('should return true when key exists in LRU', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.has('existing-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('existing-key')
    })

    it('should return false when key does not exist in LRU', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.has('non-existing-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('non-existing-key')
    })

    it('should handle empty string keys', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('')
    })
  })

  describe('getStats', () => {
    it('should return initial stats with default name', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 512
      mockLRUInstance.max = 100

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 0,
        hitRate: undefined,
        hits: 0,
        itemCount: 5,
        length: 512,
        max: 100,
        name: 'disk-lru-cache',
        total: 0,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      const customName = 'my-cache'

      // Act
      const stats = cache.getStats(customName)

      // Assert
      expect(stats.name).toBe(customName)
    })

    it('should calculate hitRate correctly when total > 0', () => {
      // Arrange
      cache['hits'] = 10
      cache['total'] = 20

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange
      cache['hits'] = 0
      cache['total'] = 0

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should reset reported values after stats retrieval', () => {
      // Arrange
      cache['hits'] = 15
      cache['total'] = 25
      cache['disposed'] = 3

      // Act
      const firstStats = cache.getStats()
      const secondStats = cache.getStats()

      // Assert
      expect(firstStats.hits).toBe(15)
      expect(firstStats.total).toBe(25)
      expect(firstStats.disposedItems).toBe(3)
      // Second call should show incremental changes
      expect(secondStats.hits).toBe(0)
      expect(secondStats.total).toBe(0)
      expect(secondStats.disposedItems).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      cache['hits'] = 25
      cache['total'] = 50
      cache['disposed'] = 5
      mockLRUInstance.itemCount = 10
      mockLRUInstance.length = 1024
      mockLRUInstance.max = 100

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hits: 25,
        itemCount: 10,
        length: 1024,
        max: 100,
        total: 50,
      })
    })

    it('should not reset reported values after cumulative stats retrieval', () => {
      // Arrange
      cache['hits'] = 15
      cache['total'] = 25

      // Act
      cache.getCumulativeStats()
      const secondCall = cache.getCumulativeStats()

      // Assert
      expect(secondCall.hits).toBe(15)
      expect(secondCall.total).toBe(25)
    })
  })

  describe('get', () => {
    it('should return file data when key exists and file is valid', async () => {
      // Arrange
      const fileData = 'test-data'
      const timeOfDeath = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(timeOfDeath)
      mockReadFile.mockResolvedValue(fileData)

      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toBe(fileData)
      expect(cache['total']).toBe(1)
      expect(cache['hits']).toBe(1)
      expect(mockReadFile).toHaveBeenCalledWith('/test/cache/test-key')
    })

    it('should return undefined when key does not exist in LRU', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      const result = await cache.get('non-existing-key')

      // Assert
      expect(result).toBeUndefined()
      expect(cache['total']).toBe(1)
      expect(cache['hits']).toBe(0)
    })

    it('should increment total counter even on cache miss', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      cache['total'] = 5

      // Act
      await cache.get('missing-key')

      // Assert
      expect(cache['total']).toBe(6)
    })

    it('should delete file when it is outdated and stale=true', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRUInstance.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue('outdated-data')

      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await cache.get('outdated-key')

      // Assert
      expect(mockLRUInstance.del).toHaveBeenCalledWith('outdated-key')
      expect(mockLockInstance.writeLock).toHaveBeenCalled()
    })

    it('should handle read lock errors gracefully', async () => {
      // Arrange
      const timeOfDeath = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(timeOfDeath)
      mockReadFile.mockRejectedValue(new Error('Read failed'))

      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('error-key')

      // Assert
      expect(result).toBeNull()
      expect(cache['total']).toBe(1)
      expect(cache['hits']).toBe(0)
    })

    it('should delete file marked for deletion when key does not exist', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      cache['keyToBeDeleted'] = 'key-to-delete'

      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await cache.get('different-key')

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalled()
    })

    it('should properly handle concurrent reads with lock', async () => {
      // Arrange
      const timeOfDeath = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(timeOfDeath)
      mockReadFile.mockResolvedValue('test-data')

      let releaseCallback: (() => void) | null = null
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        const release = () => {}
        callback(release)
      })

      // Act
      const result = await cache.get('concurrent-key')

      // Assert
      expect(result).toBe('test-data')
      expect(mockLockInstance.readLock).toHaveBeenCalledWith('concurrent-key', expect.any(Function))
    })
  })

  describe('set', () => {
    it('should set a key with maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      const maxAge = 5000
      const testValue = 'test-value'

      // Act
      const result = await cache.set('test-key', testValue, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        maxAge
      )
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/test-key', testValue)
    })

    it('should set a key without maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      const testValue = 'test-value'

      // Act
      const result = await cache.set('test-key', testValue)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.set).toHaveBeenCalledWith('test-key', NaN)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/test-key', testValue)
    })

    it('should set timeOfDeath to future timestamp when maxAge is provided', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      const maxAge = 10000
      const beforeTime = Date.now()

      // Act
      await cache.set('test-key', 'value', maxAge)

      // Assert
      const callArgs = mockLRUInstance.set.mock.calls[0]
      const timeOfDeath = callArgs[1]
      const afterTime = Date.now()

      expect(timeOfDeath).toBeGreaterThanOrEqual(beforeTime + maxAge)
      expect(timeOfDeath).toBeLessThanOrEqual(afterTime + maxAge)
    })

    it('should delete previously marked file before writing new one', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      cache['keyToBeDeleted'] = 'old-key'

      // Act
      await cache.set('new-key', 'value')

      // Assert
      const writeLockCalls = mockLockInstance.writeLock.mock.calls
      expect(writeLockCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('should not delete keyToBeDeleted if it is the same as current key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      cache['keyToBeDeleted'] = 'same-key'

      // Act
      await cache.set('same-key', 'value')

      // Assert
      const writeLockCalls = mockLockInstance.writeLock.mock.calls
      // Should only have one writeLock call for the set operation
      expect(writeLockCalls.length).toBe(1)
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('error-key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty string as value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('empty-key', '')

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/empty-key', '')
    })

    it('should handle null value gracefully', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('null-key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/null-key', null)
    })
  })

  describe('getPathKey (private method access)', () => {
    it('should correctly construct path from cache path and key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await cache.set('mykey', 'value')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/mykey', 'value')
    })

    it('should handle keys with slashes', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await cache.set('folder/key', 'value')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/folder/key', 'value')
    })
  })

  describe('deleteFile (private method access)', () => {
    it('should clear keyToBeDeleted after deletion', async () => {
      // Arrange
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      cache['keyToBeDeleted'] = 'test-key'

      // Act
      await cache.get('trigger-delete')

      // Assert
      // keyToBeDeleted should be set to empty string after deleteFile completes
      expect(cache['keyToBeDeleted']).toBe('')
    })
  })

  describe('edge cases and integration', () => {
    it('should handle rapid successive calls', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const results = await Promise.all([
        cache.get('key1'),
        cache.get('key2'),
        cache.get('key3'),
      ])

      // Assert
      expect(results).toEqual(['data', 'data', 'data'])
      expect(cache['total']).toBe(3)
      expect(cache['hits']).toBe(3)
    })

    it('should handle complex object values', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      const complexObject = {
        nested: {
          prop: 'value',
          array: [1, 2, 3],
        },
        timestamp: Date.now(),
      }

      // Act
      const result = await cache.set('complex-key', complexObject)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/complex-key', complexObject)
    })

    it('should properly track stats across multiple operations', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await cache.get('key1') // miss
      await cache.get('key2') // miss
      await cache.set('key3', 'value')
      await cache.get('key4') // miss

      // Assert
      expect(cache['total']).toBe(3)
      expect(cache['hits']).toBe(0)
    })

    it('should return correct stats after mixed operations', async () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 1024
      mockLRUInstance.max = 100
      cache['hits'] = 20
      cache['total'] = 50
      cache['disposed'] = 2

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.4)
      expect(stats.disposedItems).toBe(2)
    })

    it('should implement CacheLayer interface correctly', () => {
      // Assert - verify public interface
      expect(typeof cache.has).toBe('function')
      expect(typeof cache.get).toBe('function')
      expect(typeof cache.set).toBe('function')
      expect(typeof cache.getStats).toBe('function')
      expect(typeof cache.getCumulativeStats).toBe('function')
    })
  })
})
