import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions, LRUStats, CumulativeStats } from './typings'
import { WindowedCounters } from './WindowedCounters'
import ReadWriteLock from 'rwlock'

jest.mock('./WindowedCounters')
jest.mock('rwlock')
jest.mock('lru-cache')
jest.mock('fs-extra')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockWindowedCounters: jest.Mocked<WindowedCounters>
  let mockLock: jest.Mocked<ReadWriteLock>
  let mockLRU: any
  let cache: LRUDiskCache<any>
  const cachePath = '/test/cache'
  const options: LRUDiskCacheOptions = { max: 100 }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup WindowedCounters mock
    mockWindowedCounters = {
      countRead: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
      countDisposed: jest.fn(),
      windowed: jest.fn().mockReturnValue({
        disposed: 5,
        hits: 10,
        total: 20,
      }),
      cumulative: jest.fn().mockReturnValue({
        disposed: 15,
        hits: 50,
        misses: 30,
        total: 80,
      }),
    } as any
    ;(WindowedCounters as jest.Mock).mockImplementation(
      () => mockWindowedCounters
    )

    // Setup ReadWriteLock mock
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    // Setup LRU mock
    mockLRU = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 10,
      length: 25,
      max: 100,
    }
    jest.doMock('lru-cache', () => mockLRU)

    // Setup file operation mocks
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    // Re-require to get updated mocks
    jest.resetModules()
  })

  describe('constructor', () => {
    it('should initialize with default read and write functions', () => {
      // Arrange & Act
      cache = new LRUDiskCache(cachePath, options)

      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize with custom read and write functions', () => {
      // Arrange & Act
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Assert
      expect(cache).toBeDefined()
    })

    it('should set keyToBeDeleted to empty string', () => {
      // Arrange & Act
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Assert
      expect(cache['keyToBeDeleted']).toBe('')
    })

    it('should create LRU storage with dispose callback', () => {
      // Arrange & Act
      const LRU = require('lru-cache')
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Assert
      expect(LRU).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should return true when key exists in LRU storage', () => {
      // Arrange
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = cache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith('test-key')
    })

    it('should return false when key does not exist in LRU storage', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)

      // Act
      const result = cache.has('nonexistent-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRU.has).toHaveBeenCalledWith('nonexistent-key')
    })

    it('should handle empty string keys', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)

      // Act
      const result = cache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockLRU.has).toHaveBeenCalledWith('')
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should return stats with default name', () => {
      // Arrange & Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hitRate: 0.5,
        hits: 10,
        itemCount: 10,
        length: 25,
        max: 100,
        name: 'disk-lru-cache',
        total: 20,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange & Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hitRate as hits/total', () => {
      // Arrange
      mockWindowedCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 15,
        total: 30,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange
      mockWindowedCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should return cumulative stats', () => {
      // Arrange & Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 15,
        hits: 50,
        itemCount: 10,
        length: 25,
        max: 100,
        misses: 30,
        total: 80,
      })
    })

    it('should call cumulative on counters', () => {
      // Arrange & Act
      cache.getCumulativeStats()

      // Assert
      expect(mockWindowedCounters.cumulative).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should return undefined when key does not exist in storage', async () => {
      // Arrange
      mockLRU.get.mockReturnValue(undefined)
      cache['keyToBeDeleted'] = ''

      // Act
      const result = await cache.get('nonexistent-key')

      // Assert
      expect(result).toBeUndefined()
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
      expect(mockWindowedCounters.countMiss).toHaveBeenCalled()
    })

    it('should count read and hit when key exists and file is readable', async () => {
      // Arrange
      const fileData = { test: 'data' }
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue(fileData)
      cache['keyToBeDeleted'] = ''

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
      expect(mockWindowedCounters.countHit).toHaveBeenCalled()
      expect(result).toEqual(fileData)
    })

    it('should count miss and return null when file read fails', async () => {
      // Arrange
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockRejectedValue(new Error('File not found'))
      cache['keyToBeDeleted'] = ''

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(mockWindowedCounters.countMiss).toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it('should delete file and key when timeOfDeath has passed', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRU.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      cache['keyToBeDeleted'] = ''

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Mock deleteFile
      const deleteFileSpy = jest.spyOn(cache as any, 'deleteFile')
      deleteFileSpy.mockResolvedValue(true)

      // Act
      await cache.get('test-key')

      // Assert
      expect(mockLRU.del).toHaveBeenCalledWith('test-key')
      expect(deleteFileSpy).toHaveBeenCalledWith('test-key')
    })

    it('should delete pending file when keyToBeDeleted is set and read returns undefined', async () => {
      // Arrange
      mockLRU.get.mockReturnValue(undefined)
      cache['keyToBeDeleted'] = 'pending-delete-key'

      const deleteFileSpy = jest.spyOn(cache as any, 'deleteFile')
      deleteFileSpy.mockResolvedValue(true)

      // Act
      await cache.get('test-key')

      // Assert
      expect(deleteFileSpy).toHaveBeenCalledWith('pending-delete-key')
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should set key in storage and write file successfully', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = ''

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.set).toHaveBeenCalledWith('test-key', NaN)
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should set key with maxAge and calculate timeOfDeath', async () => {
      // Arrange
      const maxAge = 5000
      mockWriteFile.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = ''

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const beforeTime = Date.now()

      // Act
      await cache.set('test-key', { data: 'test' }, maxAge)

      const afterTime = Date.now()

      // Assert
      expect(mockLRU.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        maxAge
      )

      const callArgs = mockLRU.set.mock.calls[0]
      const timeOfDeath = callArgs[1]
      expect(timeOfDeath).toBeGreaterThanOrEqual(beforeTime + maxAge)
      expect(timeOfDeath).toBeLessThanOrEqual(afterTime + maxAge)
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      cache['keyToBeDeleted'] = ''

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(false)
    })

    it('should delete pending file when setting new key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = 'old-key'

      const deleteFileSpy = jest.spyOn(cache as any, 'deleteFile')
      deleteFileSpy.mockResolvedValue(true)

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.set('new-key', { data: 'test' })

      // Assert
      expect(deleteFileSpy).toHaveBeenCalledWith('old-key')
    })

    it('should not delete pending file if it is the same key being set', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = 'same-key'

      const deleteFileSpy = jest.spyOn(cache as any, 'deleteFile')
      deleteFileSpy.mockResolvedValue(true)

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.set('same-key', { data: 'test' })

      // Assert
      expect(deleteFileSpy).not.toHaveBeenCalled()
    })
  })

  describe('getPathKey', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should join cachePath with key', () => {
      // Arrange & Act
      const pathKey = cache['getPathKey']('test-key')

      // Assert
      expect(pathKey).toContain(cachePath)
      expect(pathKey).toContain('test-key')
    })

    it('should handle keys with special characters', () => {
      // Arrange & Act
      const pathKey = cache['getPathKey']('test/special:key')

      // Assert
      expect(pathKey).toContain(cachePath)
      expect(pathKey).toContain('test')
    })
  })

  describe('deleteFile', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should delete file and return true on success', async () => {
      // Arrange
      const { remove } = require('fs-extra')
      remove.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = 'some-key'

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache['deleteFile']('test-key')

      // Assert
      expect(result).toBe(true)
      expect(cache['keyToBeDeleted']).toBe('')
    })

    it('should return false when delete fails', async () => {
      // Arrange
      const { remove } = require('fs-extra')
      remove.mockRejectedValue(new Error('Delete failed'))
      cache['keyToBeDeleted'] = 'some-key'

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache['deleteFile']('test-key')

      // Assert
      expect(result).toBe(false)
      expect(cache['keyToBeDeleted']).toBe('')
    })

    it('should clear keyToBeDeleted after deletion attempt', async () => {
      // Arrange
      const { remove } = require('fs-extra')
      remove.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = 'original-key'

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache['deleteFile']('test-key')

      // Assert
      expect(cache['keyToBeDeleted']).toBe('')
    })
  })

  describe('LRU dispose callback', () => {
    it('should set keyToBeDeleted and count disposal when item is evicted', () => {
      // Arrange
      let disposeCallback: ((key: string) => void) | undefined

      // Capture the dispose callback
      const LRU = require('lru-cache')
      LRU.mockImplementation((options: any) => {
        disposeCallback = options.dispose
        return mockLRU
      })

      // Act
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      disposeCallback?.('evicted-key')

      // Assert
      expect(cache['keyToBeDeleted']).toBe('evicted-key')
      expect(mockWindowedCounters.countDisposed).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should handle very long keys', async () => {
      // Arrange
      const longKey = 'k'.repeat(1000)
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = cache.has(longKey)

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith(longKey)
    })

    it('should handle numeric zero as maxAge', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = ''

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', { data: 'test' }, 0)

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        0
      )
    })

    it('should handle null value objects', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      cache['keyToBeDeleted'] = ''

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', null)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalled()
    })
  })
})
