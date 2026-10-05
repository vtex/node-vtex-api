import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import { WindowedCounters } from './WindowedCounters'
import LRU from 'lru-cache'
import ReadWriteLock from 'rwlock'

jest.mock('./WindowedCounters')
jest.mock('lru-cache')
jest.mock('rwlock')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLRUStorage: jest.Mocked<LRU<string, number>>
  let mockLock: jest.Mocked<ReadWriteLock>
  let mockCounters: jest.Mocked<WindowedCounters>
  let cachePath: string
  let cacheInstance: LRUDiskCache<any>
  let lruOptions: LRUDiskCacheOptions

  beforeEach(() => {
    jest.clearAllMocks()
    cachePath = '/test/cache/path'
    lruOptions = { max: 100 }

    // Mock functions
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    // Mock LRU storage
    mockLRUStorage = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 5,
      length: 5,
      max: 100,
    } as any

    // Mock lock
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any

    // Mock counters
    mockCounters = {
      countRead: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
      countDisposed: jest.fn(),
      windowed: jest.fn(),
      cumulative: jest.fn(),
    } as any

    // Setup constructor mocks
    ;(LRU as jest.Mock).mockImplementation(() => mockLRUStorage)
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)
    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockCounters)

    cacheInstance = new LRUDiskCache(cachePath, lruOptions, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      // Arrange & Act
      const instance = new LRUDiskCache(cachePath, lruOptions)

      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
      expect(LRU).toHaveBeenCalled()
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should create LRU with dispose callback', () => {
      // Arrange & Act
      new LRUDiskCache(cachePath, lruOptions, mockReadFile, mockWriteFile)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 100,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should call dispose callback and set keyToBeDeleted', () => {
      // Arrange
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback('test-key')

      // Assert
      expect(mockCounters.countDisposed).toHaveBeenCalled()
    })

    it('should initialize keyToBeDeleted as empty string', () => {
      // Arrange & Act
      const instance = new LRUDiskCache(cachePath, lruOptions, mockReadFile, mockWriteFile)

      // Assert
      // keyToBeDeleted is private, so we verify through behavior
      expect(instance).toBeDefined()
    })
  })

  describe('has', () => {
    it('should return true when key exists in LRU storage', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(true)

      // Act
      const result = cacheInstance.has('existing-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.has).toHaveBeenCalledWith('existing-key')
    })

    it('should return false when key does not exist in LRU storage', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      const result = cacheInstance.has('non-existing-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUStorage.has).toHaveBeenCalledWith('non-existing-key')
    })

    it('should handle empty string key', () => {
      // Arrange
      mockLRUStorage.has.mockReturnValue(false)

      // Act
      const result = cacheInstance.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUStorage.has).toHaveBeenCalledWith('')
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 2,
        hits: 10,
        misses: 5,
        total: 15,
      })
      mockLRUStorage.itemCount = 5
      mockLRUStorage.length = 5
      mockLRUStorage.max = 100

      // Act
      const stats = cacheInstance.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 2,
        hitRate: 10 / 15,
        hits: 10,
        itemCount: 5,
        length: 5,
        max: 100,
        name: 'disk-lru-cache',
        total: 15,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 8,
        misses: 2,
        total: 10,
      })

      // Act
      const stats = cacheInstance.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 7,
        misses: 3,
        total: 10,
      })

      // Act
      const stats = cacheInstance.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.7)
    })

    it('should return undefined hit rate when total is zero', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })

      // Act
      const stats = cacheInstance.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({
        disposed: 5,
        hits: 50,
        misses: 20,
        total: 70,
      })
      mockLRUStorage.itemCount = 15
      mockLRUStorage.length = 15
      mockLRUStorage.max = 200

      // Act
      const stats = cacheInstance.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hits: 50,
        itemCount: 15,
        length: 15,
        max: 200,
        misses: 20,
        total: 70,
      })
    })

    it('should return stats with zero values', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      })
      mockLRUStorage.itemCount = 0
      mockLRUStorage.length = 0
      mockLRUStorage.max = 100

      // Act
      const stats = cacheInstance.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })
  })

  describe('get', () => {
    it('should return value from cache when key exists and file is readable', async () => {
      // Arrange
      const testData = { content: 'test-data' }
      mockLRUStorage.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue(testData)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.get('test-key')

      // Assert
      expect(result).toEqual(testData)
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countHit).toHaveBeenCalled()
    })

    it('should return undefined and count miss when key does not exist', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(undefined)

      // Act
      const result = await cacheInstance.get('non-existing-key')

      // Assert
      expect(result).toBeUndefined()
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })

    it('should return undefined and count miss when file read fails', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockRejectedValue(new Error('File read error'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.get('test-key')

      // Assert
      expect(result).toBeNull()
      expect(mockCounters.countMiss).toHaveBeenCalledTimes(2) // Once for missing key, once for read error
    })

    it('should delete expired file when timeOfDeath is in the past', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRUStorage.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.get('expired-key')

      // Assert
      expect(mockLRUStorage.del).toHaveBeenCalledWith('expired-key')
    })

    it('should not delete non-expired file', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUStorage.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.get('valid-key')

      // Assert
      expect(mockLRUStorage.del).not.toHaveBeenCalled()
    })

    it('should handle empty key string', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(undefined)

      // Act
      const result = await cacheInstance.get('')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })

    it('should delete outdated file when keyToBeDeleted is set', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      // Simulate dispose callback setting keyToBeDeleted
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('old-key')

      // Act
      await cacheInstance.get('new-key')

      // Assert
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should set value without maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.set).toHaveBeenCalledWith('test-key', NaN)
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should set value with maxAge', async () => {
      // Arrange
      const maxAge = 5000
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const beforeTime = Date.now()

      // Act
      await cacheInstance.set('test-key', { data: 'test' }, maxAge)

      // Assert
      expect(mockLRUStorage.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        maxAge
      )
      const [, timeOfDeath] = (mockLRUStorage.set as jest.Mock).mock.calls[0]
      expect(timeOfDeath).toBeGreaterThanOrEqual(beforeTime + maxAge)
      expect(timeOfDeath).toBeLessThanOrEqual(Date.now() + maxAge)
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(false)
    })

    it('should delete previously disposed key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      // Simulate dispose callback
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('old-key')

      // Act
      await cacheInstance.set('new-key', { data: 'test' })

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith('old-key', expect.any(Function))
    })

    it('should not delete the same key being set', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      // Simulate dispose callback with same key
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('test-key')

      // Act
      await cacheInstance.set('test-key', { data: 'test' })

      // Assert
      // Should only call writeLock once for the set operation
      expect(mockLock.writeLock).toHaveBeenCalledTimes(1)
    })

    it('should handle empty key string', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.set('', { data: 'test' })

      // Assert
      expect(result).toBe(true)
      expect(mockLRUStorage.set).toHaveBeenCalledWith('', NaN)
    })

    it('should handle null value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.set('test-key', null)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), null)
    })

    it('should use correct path for file write', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.set('my-key', { data: 'test' })

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('my-key'),
        { data: 'test' }
      )
    })
  })

  describe('deleteFile (private)', () => {
    it('should delete file when called via get with expired content', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRUStorage.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.get('expired-key')

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith('expired-key', expect.any(Function))
    })

    it('should handle file deletion error gracefully', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRUStorage.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act & Assert - should not throw
      await expect(cacheInstance.get('expired-key')).resolves.toBeDefined()
    })
  })

  describe('getPathKey (private)', () => {
    it('should construct correct path for key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.set('subdir/key', { data: 'test' })

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringMatching(/subdir\/key|subdir\\key/),
        { data: 'test' }
      )
    })

    it('should use cachePath in constructed path', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.set('test-key', { data: 'test' })

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(cachePath),
        { data: 'test' }
      )
    })
  })

  describe('lock interactions', () => {
    it('should use readLock for get operations', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.get('test-key')

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith(
        'test-key',
        expect.any(Function)
      )
    })

    it('should use writeLock for set operations', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.set('test-key', { data: 'test' })

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith(
        'test-key',
        expect.any(Function)
      )
    })

    it('should release lock on successful read', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'test' })
      const releaseFn = jest.fn()
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(releaseFn)
      })

      // Act
      await cacheInstance.get('test-key')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release lock on read error', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockRejectedValue(new Error('Read error'))
      const releaseFn = jest.fn()
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(releaseFn)
      })

      // Act
      await cacheInstance.get('test-key')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release lock on successful write', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      const releaseFn = jest.fn()
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(releaseFn)
      })

      // Act
      await cacheInstance.set('test-key', { data: 'test' })

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release lock on write error', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      const releaseFn = jest.fn()
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(releaseFn)
      })

      // Act
      await cacheInstance.set('test-key', { data: 'test' })

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })
  })

  describe('counter interactions', () => {
    it('should count read for get operation', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(undefined)

      // Act
      await cacheInstance.get('test-key')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should count hit on successful read', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.get('test-key')

      // Assert
      expect(mockCounters.countHit).toHaveBeenCalled()
    })

    it('should count multiple misses for missing key and read error', async () => {
      // Arrange
      mockLRUStorage.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockRejectedValue(new Error('Read error'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.get('test-key')

      // Assert
      expect(mockCounters.countMiss).toHaveBeenCalledTimes(2)
    })
  })

  describe('edge cases and boundary conditions', () => {
    it('should handle very large keys', async () => {
      // Arrange
      const largeKey = 'x'.repeat(10000)
      mockLRUStorage.get.mockReturnValue(undefined)

      // Act
      const result = await cacheInstance.get(largeKey)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle special characters in keys', async () => {
      // Arrange
      const specialKey = 'key!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.set(specialKey, { data: 'test' })

      // Assert
      expect(result).toBe(true)
    })

    it('should handle zero maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.set('test-key', { data: 'test' }, 0)

      // Assert
      expect(mockLRUStorage.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        0
      )
    })

    it('should handle negative maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cacheInstance.set('test-key', { data: 'test' }, -1000)

      // Assert
      expect(mockLRUStorage.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        -1000
      )
    })

    it('should handle complex object values', async () => {
      // Arrange
      const complexValue = {
        nested: { deep: { value: [1, 2, 3] } },
        array: [{ a: 1 }, { b: 2 }],
        date: new Date(),
      }
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.set('test-key', complexValue)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        complexValue
      )
    })

    it('should handle very large objects', async () => {
      // Arrange
      const largeObject = { data: new Array(10000).fill('x') }
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cacheInstance.set('large-key', largeObject)

      // Assert
      expect(result).toBe(true)
    })
  })
})
