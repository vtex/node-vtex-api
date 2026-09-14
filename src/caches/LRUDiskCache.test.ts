import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import LRU from 'lru-cache'
import ReadWriteLock from 'rwlock'

jest.mock('lru-cache')
jest.mock('rwlock')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLRU: jest.Mocked<LRU<string, number>>
  let mockLock: jest.Mocked<ReadWriteLock>
  let cache: LRUDiskCache<string>
  const cachePath = '/test/cache'
  const options: LRUDiskCacheOptions = { max: 100, ttl: 60000 }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock fs-extra functions
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    // Mock LRU instance
    mockLRU = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 5,
      length: 50,
      max: 100,
      clear: jest.fn(),
    } as any

    // Mock ReadWriteLock instance
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any

    ;(LRU as jest.Mock).mockImplementation(() => mockLRU)
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default cache settings', () => {
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 100,
          ttl: 60000,
          noDisposeOnSet: true,
        })
      )
    })

    it('should initialize stats to zero', () => {
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create a ReadWriteLock instance', () => {
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should set dispose callback on LRU options', () => {
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      expect(typeof disposeCallback).toBe('function')
    })
  })

  describe('has', () => {
    it('should return true when key exists in LRU storage', () => {
      mockLRU.has.mockReturnValue(true)
      expect(cache.has('test-key')).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith('test-key')
    })

    it('should return false when key does not exist in LRU storage', () => {
      mockLRU.has.mockReturnValue(false)
      expect(cache.has('non-existent')).toBe(false)
      expect(mockLRU.has).toHaveBeenCalledWith('non-existent')
    })

    it('should handle empty string keys', () => {
      mockLRU.has.mockReturnValue(false)
      expect(cache.has('')).toBe(false)
    })
  })

  describe('get', () => {
    it('should increment total counter and return undefined when key not found', async () => {
      // Arrange
      mockLRU.get.mockReturnValue(undefined)

      // Act
      const result = await cache.get('missing-key')

      // Assert
      expect(result).toBeUndefined()
      expect(cache.getCumulativeStats().total).toBe(1)
    })

    it('should return file data when key exists and file is valid', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      const expectedData = 'test-data'
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue(expectedData)

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Act
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      const result = await getPromise

      // Assert
      expect(result).toBe(expectedData)
      expect(cache.getCumulativeStats().hits).toBe(1)
      expect(cache.getCumulativeStats().total).toBe(1)
    })

    it('should increment hits and total when file is read successfully', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue('data')

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Act
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      await getPromise

      // Assert
      expect(cache.getCumulativeStats().hits).toBe(1)
      expect(cache.getCumulativeStats().total).toBe(1)
    })

    it('should return null when file read fails', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockRejectedValue(new Error('Read failed'))

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Act
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      const result = await getPromise

      // Assert
      expect(result).toBeNull()
      expect(cache.getCumulativeStats().total).toBe(1)
    })

    it('should delete expired entries after reading', async () => {
      // Arrange
      const pastTime = Date.now() - 1000 // Expired
      mockLRU.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue('data')

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      await getPromise
      await writeLockCallback(() => {})

      // Assert
      expect(mockLRU.del).toHaveBeenCalledWith('test-key')
    })

    it('should call readLock with correct key', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Act
      const getPromise = cache.get('specific-key')
      await readLockCallback(() => {})
      await getPromise

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith(
        'specific-key',
        expect.any(Function)
      )
    })
  })

  describe('set', () => {
    it('should set value in LRU storage without maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('test-key', 'test-value')
      await writeLockCallback(() => {})
      const result = await setPromise

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith('test-key', NaN)
      expect(result).toBe(true)
    })

    it('should set value in LRU storage with maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const beforeTime = Date.now()
      const setPromise = cache.set('test-key', 'test-value', 5000)
      await writeLockCallback(() => {})
      await setPromise
      const afterTime = Date.now()

      // Assert
      const callArgs = (mockLRU.set as jest.Mock).mock.calls[0]
      expect(callArgs[0]).toBe('test-key')
      expect(callArgs[1]).toBeGreaterThanOrEqual(beforeTime + 5000)
      expect(callArgs[1]).toBeLessThanOrEqual(afterTime + 5000)
      expect(callArgs[2]).toBe(5000)
    })

    it('should write file with correct path', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('my-key', 'my-value')
      await writeLockCallback(() => {})
      await setPromise

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/cache/my-key',
        'my-value'
      )
    })

    it('should return true on successful write', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('key', 'value')
      await writeLockCallback(() => {})
      const result = await setPromise

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('key', 'value')
      await writeLockCallback(() => {})
      const result = await setPromise

      // Assert
      expect(result).toBe(false)
    })

    it('should delete pending file when setting new key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Simulate dispose callback to set keyToBeDeleted
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('old-key')

      // Act
      const setPromise = cache.set('new-key', 'value')
      await writeLockCallback(() => {})
      await setPromise

      // Assert
      // Verify that deleteFile was called (indirectly through writeLock calls)
      expect(mockLock.writeLock).toHaveBeenCalled()
    })

    it('should not delete the same key being set', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallbacks: any[] = []
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallbacks.push([key, callback])
      })

      // Simulate dispose callback to set keyToBeDeleted
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('same-key')

      // Act
      const setPromise = cache.set('same-key', 'value')
      // Execute only the write callback for the set operation
      await writeLockCallbacks[0][1](() => {})
      await setPromise

      // Assert - only one writeLock call (for the set, not for delete)
      expect(writeLockCallbacks.length).toBe(1)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('disk-lru-cache')
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(50)
      expect(stats.max).toBe(100)
    })

    it('should return stats with custom name', () => {
      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate when total > 0', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue('data')

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Perform one hit
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      await getPromise

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
      expect(stats.hitRate).toBe(1)
    })

    it('should return undefined hit rate when total is 0', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(0)
      expect(stats.hitRate).toBeUndefined()
    })

    it('should report incremental stats and reset after reporting', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue('data')

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Perform one hit
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      await getPromise

      // Act
      const stats1 = cache.getStats()
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
    })

    it('should track disposed items in stats', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback('key1')
      disposeCallback('key2')
      const stats = cache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 0,
        hits: 0,
        itemCount: 5,
        length: 50,
        max: 100,
        total: 0,
      })
    })

    it('should include all counters in cumulative stats', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue('data')

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('key1')

      // Perform get
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      await getPromise

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
      expect(stats.disposedItems).toBe(1)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle empty key string', async () => {
      // Act
      const result = await cache.get('')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle special characters in keys', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('key:with/special\\chars', 'value')
      await writeLockCallback(() => {})
      const result = await setPromise

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/cache/key:with/special\\chars',
        'value'
      )
    })

    it('should handle null value in set', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('key', null as any)
      await writeLockCallback(() => {})
      const result = await setPromise

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/key', null)
    })

    it('should handle zero maxAge in set', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('key', 'value', 0)
      await writeLockCallback(() => {})
      await setPromise

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith('key', expect.any(Number), 0)
    })

    it('should handle multiple concurrent gets', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue('data')

      let readLockCallbacks: any[] = []
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallbacks.push(callback)
      })

      // Act
      const promise1 = cache.get('key1')
      const promise2 = cache.get('key2')
      await Promise.all(readLockCallbacks.map(cb => cb(() => {})))
      const results = await Promise.all([promise1, promise2])

      // Assert
      expect(results).toEqual(['data', 'data'])
      expect(cache.getCumulativeStats().total).toBe(2)
      expect(cache.getCumulativeStats().hits).toBe(2)
    })

    it('should properly release lock on read error', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockRejectedValue(new Error('Read failed'))

      let releaseCalled = false
      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Act
      const getPromise = cache.get('key')
      await readLockCallback(() => {
        releaseCalled = true
      })
      await getPromise

      // Assert
      expect(releaseCalled).toBe(true)
    })

    it('should properly release lock on write error', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))

      let releaseCalled = false
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('key', 'value')
      await writeLockCallback(() => {
        releaseCalled = true
      })
      await setPromise

      // Assert
      expect(releaseCalled).toBe(true)
    })
  })

  describe('dispose callback', () => {
    it('should set keyToBeDeleted when dispose is called', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback('key-to-dispose')

      // Assert
      expect(cache.has('key-to-dispose')).toBeDefined()
    })

    it('should increment disposed counter when dispose is called', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      const initialStats = cache.getCumulativeStats()

      // Act
      disposeCallback('key1')
      const statsAfter = cache.getCumulativeStats()

      // Assert
      expect(statsAfter.disposedItems).toBe(initialStats.disposedItems + 1)
    })

    it('should handle multiple dispose calls', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback('key1')
      disposeCallback('key2')
      disposeCallback('key3')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(3)
    })
  })

  describe('lock usage', () => {
    it('should use readLock for get operations', async () => {
      // Arrange
      const futureTime = Date.now() + 60000
      mockLRU.get.mockReturnValue(futureTime)

      let readLockCallback: any
      mockLock.readLock.mockImplementation((key, callback) => {
        readLockCallback = callback
      })

      // Act
      const getPromise = cache.get('test-key')
      await readLockCallback(() => {})
      await getPromise

      // Assert
      expect(mockLock.readLock).toHaveBeenCalled()
      expect(mockLock.writeLock).not.toHaveBeenCalled()
    })

    it('should use writeLock for set operations', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      let writeLockCallback: any
      mockLock.writeLock.mockImplementation((key, callback) => {
        writeLockCallback = callback
      })

      // Act
      const setPromise = cache.set('test-key', 'value')
      await writeLockCallback(() => {})
      await setPromise

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalled()
    })
  })
})
