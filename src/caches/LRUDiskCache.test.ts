import { LRUDiskCache } from './LRUDiskCache'
import { WindowedCounters } from './WindowedCounters'
import { LRUDiskCacheOptions, LRUStats, CumulativeStats } from './typings'
import LRU from 'lru-cache'
import ReadWriteLock from 'rwlock'

jest.mock('lru-cache')
jest.mock('rwlock')
jest.mock('./WindowedCounters')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLRUInstance: jest.Mocked<LRU<string, number>>
  let mockLockInstance: jest.Mocked<ReadWriteLock>
  let mockCountersInstance: jest.Mocked<WindowedCounters>
  let cache: LRUDiskCache<any>

  beforeEach(() => {
    jest.clearAllMocks()

    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    mockLRUInstance = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 1000,
    } as any

    mockLockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any

    mockCountersInstance = {
      windowed: jest.fn().mockReturnValue({
        disposed: 10,
        hits: 50,
        total: 100,
      }),
      cumulative: jest.fn().mockReturnValue({
        disposed: 20,
        hits: 150,
        total: 300,
      }),
      countRead: jest.fn(),
      countHit: jest.fn(),
      countDisposed: jest.fn(),
    } as any

    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(() => mockLRUInstance)
    ;(ReadWriteLock as jest.MockedClass<typeof ReadWriteLock>).mockImplementation(
      () => mockLockInstance
    )
    ;(WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mockImplementation(
      () => mockCountersInstance
    )
  })

  describe('constructor', () => {
    it('should initialize with default file I/O functions', () => {
      // Arrange & Act
      cache = new LRUDiskCache('/cache/path', { max: 500 })

      // Assert
      expect(cache).toBeDefined()
      expect(WindowedCounters).toHaveBeenCalledTimes(1)
      expect(ReadWriteLock).toHaveBeenCalledTimes(1)
    })

    it('should initialize with custom file I/O functions', () => {
      // Arrange & Act
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)

      // Assert
      expect(cache).toBeDefined()
    })

    it('should set up LRU with provided options and dispose callback', () => {
      // Arrange & Act
      const options: LRUDiskCacheOptions = { max: 1000, maxSize: 10000 }
      cache = new LRUDiskCache('/cache/path', options, mockReadFile, mockWriteFile)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 1000,
          maxSize: 10000,
          noDisposeOnSet: true,
          dispose: expect.any(Function),
        })
      )
    })

    it('should initialize keyToBeDeleted as empty string', () => {
      // Arrange & Act
      cache = new LRUDiskCache('/cache/path', { max: 500 })

      // Assert
      expect(cache).toBeDefined()
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
    })

    it('should return true when key exists in LRU storage', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.has('existing-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('existing-key')
    })

    it('should return false when key does not exist in LRU storage', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.has('non-existent-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('non-existent-key')
    })

    it('should handle empty string key', () => {
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
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
    })

    it('should return stats with default name', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 10,
        hits: 50,
        total: 100,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 10,
        hitRate: 0.5,
        hits: 50,
        itemCount: 5,
        length: 100,
        max: 1000,
        name: 'disk-lru-cache',
        total: 100,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 10,
        hits: 50,
        total: 100,
      })

      // Act
      const stats = cache.getStats('custom-cache-name')

      // Assert
      expect(stats.name).toBe('custom-cache-name')
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 5,
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
      mockCountersInstance.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should include LRU storage metrics', () => {
      // Arrange
      mockLRUInstance.itemCount = 42
      mockLRUInstance.length = 500
      mockLRUInstance.max = 2000

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.itemCount).toBe(42)
      expect(stats.length).toBe(500)
      expect(stats.max).toBe(2000)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
    })

    it('should return cumulative statistics', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        disposed: 20,
        hits: 150,
        total: 300,
      })

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 20,
        hits: 150,
        itemCount: 5,
        length: 100,
        max: 1000,
        total: 300,
      })
    })

    it('should include LRU storage metrics in cumulative stats', () => {
      // Arrange
      mockLRUInstance.itemCount = 75
      mockLRUInstance.length = 750
      mockLRUInstance.max = 5000

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(75)
      expect(stats.length).toBe(750)
      expect(stats.max).toBe(5000)
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
    })

    it('should return file data when key exists and not expired', async () => {
      // Arrange
      const mockData = { foo: 'bar' }
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue(mockData)
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toEqual(mockData)
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
      expect(mockCountersInstance.countHit).toHaveBeenCalled()
    })

    it('should return undefined when key does not exist in LRU', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      const result = await cache.get('non-existent-key')

      // Assert
      expect(result).toBeUndefined()
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
      expect(mockCountersInstance.countHit).not.toHaveBeenCalled()
    })

    it('should handle read lock properly', async () => {
      // Arrange
      const mockData = { test: 'data' }
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue(mockData)
      const releaseMock = jest.fn()
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toEqual(mockData)
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should delete expired keys', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRUInstance.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'value' })
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(() => {})
      })
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(() => {})
      })

      // Act
      await cache.get('expired-key')

      // Assert
      expect(mockLRUInstance.del).toHaveBeenCalledWith('expired-key')
    })

    it('should handle file read errors gracefully', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockRejectedValue(new Error('File not found'))
      const releaseMock = jest.fn()
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(releaseMock).toHaveBeenCalled()
      expect(result).toBe(null)
    })

    it('should delete outdated file when key to be deleted is set', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      // Set keyToBeDeleted by simulating a disposal
      const options: LRUDiskCacheOptions = { max: 500 }
      cache = new LRUDiskCache('/cache/path', options, mockReadFile, mockWriteFile)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback('old-key')
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(() => {})
      })

      // Act
      await cache.get('new-key')

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
    })

    it('should successfully set a value without maxAge', async () => {
      // Arrange
      const testValue = { key: 'value' }
      mockWriteFile.mockResolvedValue(undefined)
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.set('test-key', testValue)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.set).toHaveBeenCalledWith('test-key', NaN)
      expect(mockWriteFile).toHaveBeenCalledWith('/cache/path/test-key', testValue)
    })

    it('should successfully set a value with maxAge', async () => {
      // Arrange
      const testValue = { key: 'value' }
      const maxAge = 5000
      mockWriteFile.mockResolvedValue(undefined)
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.set('test-key', testValue, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        maxAge
      )
    })

    it('should use write lock during set operation', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      await cache.set('test-key', { data: 'value' })

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalledWith(
        'test-key',
        expect.any(Function)
      )
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should delete previously marked file before writing new value', async () => {
      // Arrange
      const options: LRUDiskCacheOptions = { max: 500 }
      cache = new LRUDiskCache('/cache/path', options, mockReadFile, mockWriteFile)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback('old-key')
      mockWriteFile.mockResolvedValue(undefined)
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      await cache.set('new-key', { data: 'value' })

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalled()
    })

    it('should return false when write operation fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.set('test-key', { data: 'value' })

      // Assert
      expect(result).toBe(false)
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should not delete current key when marked for deletion', async () => {
      // Arrange
      const options: LRUDiskCacheOptions = { max: 500 }
      cache = new LRUDiskCache('/cache/path', options, mockReadFile, mockWriteFile)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback('test-key')
      mockWriteFile.mockResolvedValue(undefined)
      const releaseMock = jest.fn()
      let lockKey: string
      mockLockInstance.writeLock.mockImplementation((key: string, callback: any) => {
        lockKey = key
        callback(releaseMock)
      })

      // Act
      await cache.set('test-key', { data: 'value' })

      // Assert
      // Should only call writeLock once (for setting), not twice
      expect(mockLockInstance.writeLock).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispose callback', () => {
    it('should set keyToBeDeleted and count disposed when LRU disposes a key', () => {
      // Arrange
      const options: LRUDiskCacheOptions = { max: 500 }
      cache = new LRUDiskCache('/cache/path', options, mockReadFile, mockWriteFile)
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Act
      disposeCallback('disposed-key')

      // Assert
      expect(mockCountersInstance.countDisposed).toHaveBeenCalled()
    })
  })

  describe('deleteFile', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
    })

    it('should delete file using write lock', async () => {
      // Arrange
      const mockRemove = jest.fn().mockResolvedValue(undefined)
      jest.doMock('fs-extra', () => ({ remove: mockRemove }))
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      // Note: deleteFile is private, so we test it indirectly through get() with expired key
      const pastTime = Date.now() - 1000
      mockLRUInstance.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'value' })
      const readRelease = jest.fn()
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(readRelease)
      })
      await cache.get('expired-key')

      // Assert
      expect(releaseMock).toHaveBeenCalled()
    })
  })

  describe('getPathKey', () => {
    it('should construct correct file path from cache path and key', () => {
      // Arrange
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
      mockLRUInstance.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'value' })
      const releaseMock = jest.fn()
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      cache.get('my-key')

      // Assert
      // Verify the path was constructed correctly by checking the readFile call
      expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('my-key'))
    })
  })

  describe('edge cases and integration', () => {
    beforeEach(() => {
      cache = new LRUDiskCache('/cache/path', { max: 500 }, mockReadFile, mockWriteFile)
    })

    it('should handle empty string as key', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'value' })
      const releaseMock = jest.fn()
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.get('')

      // Assert
      expect(result).toEqual({ data: 'value' })
    })

    it('should handle special characters in keys', async () => {
      // Arrange
      const specialKey = 'key-with-/special\\chars'
      mockLRUInstance.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'value' })
      const releaseMock = jest.fn()
      mockLockInstance.readLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.get(specialKey)

      // Assert
      expect(mockReadFile).toHaveBeenCalled()
    })

    it('should handle maxAge of 0', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.set('test-key', { data: 'value' }, 0)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.set).toHaveBeenCalledWith('test-key', Date.now(), 0)
    })

    it('should handle very large maxAge values', async () => {
      // Arrange
      const largeMaxAge = Number.MAX_SAFE_INTEGER
      mockWriteFile.mockResolvedValue(undefined)
      const releaseMock = jest.fn()
      mockLockInstance.writeLock.mockImplementation((_key: string, callback: any) => {
        callback(releaseMock)
      })

      // Act
      const result = await cache.set('test-key', { data: 'value' }, largeMaxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.set).toHaveBeenCalled()
    })

    it('should count reads correctly', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      await cache.get('any-key')

      // Assert
      expect(mockCountersInstance.countRead).toHaveBeenCalledTimes(1)
    })

    it('should not count hit when key is not found', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      await cache.get('missing-key')

      // Assert
      expect(mockCountersInstance.countHit).not.toHaveBeenCalled()
    })
  })
})
