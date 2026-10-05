import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import ReadWriteLock from 'rwlock'

jest.mock('rwlock')
jest.mock('fs-extra')
jest.mock('./WindowedCounters')

import { WindowedCounters } from './WindowedCounters'

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLock: jest.Mocked<ReadWriteLock>
  let mockCounters: jest.Mocked<WindowedCounters>
  let cachePath: string
  let cache: LRUDiskCache<{ data: string }>
  const options: LRUDiskCacheOptions = {
    max: 100,
    maxSize: 1000,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    cachePath = '/test/cache'
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as unknown as jest.Mocked<ReadWriteLock>
    mockCounters = {
      windowed: jest.fn().mockReturnValue({
        disposed: 0,
        hits: 0,
        total: 0,
      }),
      cumulative: jest.fn().mockReturnValue({
        disposed: 0,
        hits: 0,
        misses: 0,
        total: 0,
      }),
      countRead: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
      countDisposed: jest.fn(),
    } as unknown as jest.Mocked<WindowedCounters>

    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockCounters)
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default dependencies when not provided', () => {
      // Arrange & Act
      const cacheInstance = new LRUDiskCache(cachePath, options)

      // Assert
      expect(cacheInstance).toBeInstanceOf(LRUDiskCache)
    })

    it('should initialize counters', () => {
      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })

    it('should initialize read-write lock', () => {
      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should set keyToBeDeleted to empty string', () => {
      // Assert
      expect(cache['keyToBeDeleted']).toBe('')
    })

    it('should create LRU storage with dispose callback', () => {
      // Assert
      expect(cache['lruStorage']).toBeDefined()
      expect(cache['lruStorage'].max).toBe(100)
    })
  })

  describe('has', () => {
    it('should return true when key exists in storage', () => {
      // Arrange
      cache['lruStorage'].set('test-key', 123)

      // Act
      const result = cache.has('test-key')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when key does not exist', () => {
      // Act
      const result = cache.has('non-existent-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should return false for empty string key', () => {
      // Act
      const result = cache.has('')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.name).toBe('disk-lru-cache')
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('total')
    })

    it('should return stats with custom name', () => {
      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hitRate correctly when total > 0', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 0,
        hits: 50,
        total: 100,
      })

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(0.5)
    })

    it('should return undefined hitRate when total is 0', () => {
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

    it('should include LRU storage metrics', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.itemCount).toBe(cache['lruStorage'].itemCount)
      expect(stats.length).toBe(cache['lruStorage'].length)
      expect(stats.max).toBe(cache['lruStorage'].max)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({
        disposed: 5,
        hits: 100,
        misses: 50,
        total: 150,
      })

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.disposedItems).toBe(5)
      expect(stats.hits).toBe(100)
      expect(stats.misses).toBe(50)
      expect(stats.total).toBe(150)
    })

    it('should include LRU storage metrics', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(cache['lruStorage'].itemCount)
      expect(stats.length).toBe(cache['lruStorage'].length)
      expect(stats.max).toBe(cache['lruStorage'].max)
    })
  })

  describe('get', () => {
    it('should return undefined and count miss when key does not exist', async () => {
      // Act
      const result = await cache.get('non-existent-key')

      // Assert
      expect(result).toBeUndefined()
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })

    it('should read file and count hit when key exists and is not stale', async () => {
      // Arrange
      const testData = { data: 'test-value' }
      const futureTime = Date.now() + 10000
      cache['lruStorage'].set('test-key', futureTime)
      mockReadFile.mockResolvedValue(testData)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toEqual(testData)
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countHit).toHaveBeenCalled()
      expect(mockReadFile).toHaveBeenCalledWith(`${cachePath}/test-key`)
    })

    it('should count miss when file read fails', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      cache['lruStorage'].set('test-key', futureTime)
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toBeNull()
      expect(mockCounters.countMiss).toHaveBeenCalledTimes(2) // once for read, once for catch
    })

    it('should delete stale file and its LRU entry', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      cache['lruStorage'].set('stale-key', pastTime)
      mockReadFile.mockResolvedValue({ data: 'stale-value' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const deleteSpy = jest.spyOn(cache['lruStorage'], 'del')

      // Act
      await cache.get('stale-key')

      // Assert
      expect(deleteSpy).toHaveBeenCalledWith('stale-key')
    })

    it('should delete keyToBeDeleted file on miss', async () => {
      // Arrange
      cache['keyToBeDeleted'] = 'old-key'
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.get('new-key')

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalled()
    })

    it('should handle read lock properly', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      cache['lruStorage'].set('test-key', futureTime)
      const releaseCallback = jest.fn()
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(releaseCallback)
      })

      // Act
      await cache.get('test-key')

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith('test-key', expect.any(Function))
      expect(releaseCallback).toHaveBeenCalled()
    })

    it('should handle empty string key', async () => {
      // Act
      const result = await cache.get('')

      // Assert
      expect(result).toBeUndefined()
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should set value without maxAge', async () => {
      // Arrange
      const testData = { data: 'test-value' }
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', testData)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(`${cachePath}/test-key`, testData)
      expect(cache['lruStorage'].has('test-key')).toBe(true)
    })

    it('should set value with maxAge', async () => {
      // Arrange
      const testData = { data: 'test-value' }
      const maxAge = 5000
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', testData, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(cache['lruStorage'].has('test-key')).toBe(true)
    })

    it('should return false when write fails', async () => {
      // Arrange
      const testData = { data: 'test-value' }
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', testData)

      // Assert
      expect(result).toBe(false)
    })

    it('should delete keyToBeDeleted if it differs from current key', async () => {
      // Arrange
      cache['keyToBeDeleted'] = 'old-key'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.set('new-key', { data: 'value' })

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalled()
    })

    it('should not delete keyToBeDeleted if it matches current key', async () => {
      // Arrange
      cache['keyToBeDeleted'] = 'same-key'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const writeLockCallCount = mockLock.writeLock.mock.calls.length

      // Act
      await cache.set('same-key', { data: 'value' })

      // Assert
      // Should only have one writeLock call (for writing, not deleting)
      expect(mockLock.writeLock.mock.calls.length).toBe(writeLockCallCount + 1)
    })

    it('should handle write lock properly', async () => {
      // Arrange
      const releaseCallback = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(releaseCallback)
      })

      // Act
      await cache.set('test-key', { data: 'value' })

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith('test-key', expect.any(Function))
      expect(releaseCallback).toHaveBeenCalled()
    })

    it('should handle empty string key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('', { data: 'value' })

      // Assert
      expect(result).toBe(true)
      expect(cache['lruStorage'].has('')).toBe(true)
    })

    it('should set NaN for timeOfDeath when maxAge is undefined', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.set('test-key', { data: 'value' }, undefined)

      // Assert
      const storedValue = cache['lruStorage'].get('test-key')
      expect(isNaN(storedValue as number)).toBe(true)
    })
  })

  describe('getPathKey', () => {
    it('should join cache path with key', () => {
      // Act
      const pathKey = cache['getPathKey']('test-key')

      // Assert
      expect(pathKey).toBe(`${cachePath}/test-key`)
    })

    it('should handle empty key', () => {
      // Act
      const pathKey = cache['getPathKey']('')

      // Assert
      expect(pathKey).toBe(cachePath)
    })

    it('should handle keys with slashes', () => {
      // Act
      const pathKey = cache['getPathKey']('sub/dir/key')

      // Assert
      expect(pathKey).toContain('sub')
      expect(pathKey).toContain('dir')
      expect(pathKey).toContain('key')
    })
  })

  describe('deleteFile', () => {
    it('should delete file using remove', async () => {
      // Arrange
      const { remove } = require('fs-extra')
      remove.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache['deleteFile']('test-key')

      // Assert
      expect(result).toBe(true)
      expect(remove).toHaveBeenCalledWith(`${cachePath}/test-key`)
    })

    it('should clear keyToBeDeleted', async () => {
      // Arrange
      cache['keyToBeDeleted'] = 'some-key'
      const { remove } = require('fs-extra')
      remove.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache['deleteFile']('test-key')

      // Assert
      expect(cache['keyToBeDeleted']).toBe('')
    })

    it('should return false when remove fails', async () => {
      // Arrange
      const { remove } = require('fs-extra')
      remove.mockRejectedValue(new Error('Delete failed'))
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache['deleteFile']('test-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle write lock properly', async () => {
      // Arrange
      const releaseCallback = jest.fn()
      const { remove } = require('fs-extra')
      remove.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(releaseCallback)
      })

      // Act
      await cache['deleteFile']('test-key')

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith('test-key', expect.any(Function))
      expect(releaseCallback).toHaveBeenCalled()
    })
  })

  describe('LRU dispose callback', () => {
    it('should set keyToBeDeleted and count disposed when item is evicted', () => {
      // Arrange
      const smallOptions = { max: 2 }
      cache = new LRUDiskCache(cachePath, smallOptions, mockReadFile, mockWriteFile)

      // Act
      cache['lruStorage'].set('key1', 1)
      cache['lruStorage'].set('key2', 2)
      cache['lruStorage'].set('key3', 3) // This should evict key1

      // Assert
      expect(cache['keyToBeDeleted']).toBe('key1')
      expect(mockCounters.countDisposed).toHaveBeenCalled()
    })
  })

  describe('integration scenarios', () => {
    it('should handle get-set-get cycle', async () => {
      // Arrange
      const testData = { data: 'test-value' }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(testData)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const setResult = await cache.set('test-key', testData)
      const getResult = await cache.get('test-key')

      // Assert
      expect(setResult).toBe(true)
      expect(getResult).toEqual(testData)
    })

    it('should handle multiple keys', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.set('key1', { data: '1' })
      await cache.set('key2', { data: '2' })
      await cache.set('key3', { data: '3' })

      // Assert
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(true)
      expect(cache.has('key3')).toBe(true)
    })

    it('should handle concurrent operations with locks', async () => {
      // Arrange
      const testData = { data: 'concurrent' }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(testData)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await Promise.all([
        cache.set('key1', testData),
        cache.set('key2', testData),
        cache.get('key1'),
      ])

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalled()
      expect(mockLock.readLock).toHaveBeenCalled()
    })
  })
})
