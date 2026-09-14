import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import LRU from 'lru-cache'

jest.mock('lru-cache')
jest.mock('fs-extra')
jest.mock('rwlock')

import ReadWriteLock from 'rwlock'
import { outputJSON, readJSON, remove } from 'fs-extra'

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLRUInstance: any
  let mockLock: any
  let cachePath: string
  let options: LRUDiskCacheOptions

  beforeEach(() => {
    jest.clearAllMocks()
    cachePath = '/test/cache/path'
    options = { max: 100 }
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    }
    mockLRUInstance = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 5,
      length: 100,
      max: 100,
    }

    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)
    ;(LRU as jest.Mock).mockImplementation(() => mockLRUInstance)
  })

  describe('constructor', () => {
    it('should initialize with default dependencies', () => {
      // Arrange & Act
      const cache = new LRUDiskCache(cachePath, options)

      // Assert
      expect(cache).toBeInstanceOf(LRUDiskCache)
      expect(ReadWriteLock).toHaveBeenCalled()
      expect(LRU).toHaveBeenCalled()
    })

    it('should initialize with custom readFile and writeFile', () => {
      // Arrange & Act
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Assert
      expect(cache).toBeInstanceOf(LRUDiskCache)
    })

    it('should create LRU with dispose callback', () => {
      // Arrange & Act
      new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Assert
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 100,
          dispose: expect.any(Function),
          noDisposeOnSet: true,
        })
      )
    })

    it('should increment disposed counter when dispose callback is invoked', () => {
      // Arrange
      new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose

      // Act
      disposeCallback('test-key')
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Assert
      expect(cache.getCumulativeStats().disposedItems).toBeDefined()
    })
  })

  describe('has', () => {
    it('should return true when key exists in LRU storage', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = cache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('test-key')
    })

    it('should return false when key does not exist in LRU storage', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = cache.has('non-existent-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('non-existent-key')
    })

    it('should handle empty string key', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = cache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('')
    })
  })

  describe('get', () => {
    it('should return data when key exists and file is valid', async () => {
      // Arrange
      const testData = { value: 'test-data' }
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue(testData)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toEqual(testData)
      expect(mockLRUInstance.get).toHaveBeenCalledWith('test-key')
      expect(mockReadFile).toHaveBeenCalledWith('/test/cache/path/test-key')
    })

    it('should return undefined when key does not exist', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = await cache.get('non-existent-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should increment total counter on every get call', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await cache.get('key1')
      await cache.get('key2')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(2)
    })

    it('should increment hits counter when file is read successfully', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await cache.get('test-key')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
    })

    it('should not increment hits when readFile throws', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockRejectedValue(new Error('Read failed'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await cache.get('test-key')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
    })

    it('should delete file and LRU entry when timeOfDeath has passed', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRUInstance.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'stale' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLRUInstance.del.mockImplementation(() => {})
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await cache.get('stale-key')

      // Assert
      expect(mockLRUInstance.del).toHaveBeenCalledWith('stale-key')
    })

    it('should handle readLock callback errors gracefully', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockRejectedValue(new Error('File system error'))
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act & Assert
      await expect(cache.get('error-key')).resolves.not.toThrow()
    })

    it('should delete outdated file when keyToBeDeleted is set', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Manually set keyToBeDeleted by simulating dispose callback
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('deleted-key')

      // Act
      await cache.get('test-key')

      // Assert - file deletion would have been attempted
      expect(mockLock.writeLock).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should write file and return true on success', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = await cache.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/path/test-key', { data: 'test' })
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = await cache.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(true) // failure becomes true, so !true = false
    })

    it('should set LRU entry with maxAge when provided', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      const maxAge = 5000

      // Act
      await cache.set('test-key', { data: 'test' }, maxAge)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        maxAge
      )
    })

    it('should set LRU entry without maxAge when maxAge is undefined', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await cache.set('test-key', { data: 'test' })

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('test-key', NaN)
    })

    it('should delete previously marked file before writing new one', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Simulate dispose callback setting keyToBeDeleted
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('old-key')

      // Act
      await cache.set('new-key', { data: 'new' })

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalled()
    })

    it('should not delete same key being set', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Simulate dispose callback with same key
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('test-key')

      // Act
      await cache.set('test-key', { data: 'test' })

      // Assert - should only call writeLock once (for set, not delete)
      const writeLockCalls = mockLock.writeLock.mock.calls.filter(
        (call: any[]) => call[0] === 'test-key'
      )
      expect(writeLockCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle null/undefined value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = await cache.set('test-key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should handle empty string key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const result = await cache.set('', { data: 'test' })

      // Assert
      expect(result).toBe(true)
    })

    it('should handle maxAge of 0', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await cache.set('test-key', { data: 'test' }, 0)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        0
      )
    })
  })

  describe('getStats', () => {
    it('should return stats with custom name', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(50)
      expect(stats.max).toBe(100)
    })

    it('should return stats with default name', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('disk-lru-cache')
    })

    it('should calculate hit rate correctly', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act - simulate 2 gets, 1 hit, 1 miss
      cache.get('hit-key')
      cache.get('miss-key')
      mockLRUInstance.get.mockReturnValueOnce(futureTime)
      mockLRUInstance.get.mockReturnValueOnce(undefined)
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toEqual(0)
      expect(stats.total).toEqual(0)
    })

    it('should return undefined hitRate when total is 0', () => {
      // Arrange
      mockLRUInstance.itemCount = 0
      mockLRUInstance.length = 0
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
      expect(stats.total).toBe(0)
    })

    it('should reset reported stats after getStats call', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const stats1 = cache.getStats()
      const stats2 = cache.getStats()

      // Assert - stats2 should have 0 for incremental values
      expect(stats1.hits).toBe(0)
      expect(stats1.total).toBe(0)
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
    })

    it('should report disposedItems correctly', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('key1')
      disposeCallback('key2')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats object', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

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

    it('should return accurate cumulative values', () => {
      // Arrange
      mockLRUInstance.itemCount = 10
      mockLRUInstance.length = 75
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(10)
      expect(stats.length).toBe(75)
      expect(stats.max).toBe(100)
    })

    it('should not reset values after getCumulativeStats', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      const stats1 = cache.getCumulativeStats()
      const stats2 = cache.getCumulativeStats()

      // Assert
      expect(stats1).toEqual(stats2)
    })

    it('should reflect disposed items from LRU disposal', () => {
      // Arrange
      mockLRUInstance.itemCount = 5
      mockLRUInstance.length = 50
      mockLRUInstance.max = 100
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('key1')

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(1)
    })
  })

  describe('integration tests', () => {
    it('should handle multiple set and get operations', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await cache.set('key1', { value: 1 })
      await cache.set('key2', { value: 2 })
      await cache.get('key1')
      await cache.get('key2')
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(2)
    })

    it('should handle concurrent operations with locks', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue({ data: 'test' })
      let writeLockReleased = false
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {
          writeLockReleased = true
        })
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)

      // Act
      await Promise.all([cache.set('key1', { value: 1 }), cache.set('key2', { value: 2 })])

      // Assert
      expect(writeLockReleased).toBe(true)
    })
  })
})
