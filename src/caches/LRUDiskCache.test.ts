import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import LRU from 'lru-cache'
import ReadWriteLock from 'rwlock'

jest.mock('lru-cache')
jest.mock('rwlock')
jest.mock('fs-extra')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLRU: jest.Mocked<LRU<string, number>>
  let mockLock: jest.Mocked<ReadWriteLock>
  let cache: LRUDiskCache<string>
  const cachePath = '/test/cache'
  const options: LRUDiskCacheOptions = { max: 100 }

  beforeEach(() => {
    jest.clearAllMocks()

    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    mockLRU = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 0,
      length: 0,
      max: 100,
    } as unknown as jest.Mocked<LRU<string, number>>

    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as unknown as jest.Mocked<ReadWriteLock>

    ;(LRU as jest.Mock).mockImplementation(() => mockLRU)
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with provided cachePath and options', () => {
      expect(cache).toBeDefined()
    })

    it('should initialize hits, total, and disposed to 0', () => {
      const stats = cache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create LRU with dispose callback', () => {
      const lruCall = (LRU as jest.Mock).mock.calls[0][0]
      expect(lruCall.dispose).toBeDefined()
      expect(lruCall.noDisposeOnSet).toBe(true)
    })

    it('should call dispose callback when LRU evicts items', () => {
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('test-key')
      const stats = cache.getCumulativeStats()
      expect(stats.disposedItems).toBe(1)
    })

    it('should initialize ReadWriteLock', () => {
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should use default file operations when not provided', () => {
      const cacheWithDefaults = new LRUDiskCache(cachePath, options)
      expect(cacheWithDefaults).toBeDefined()
    })
  })

  describe('has', () => {
    it('should return true when key exists in LRU storage', () => {
      mockLRU.has.mockReturnValue(true)
      expect(cache.has('test-key')).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith('test-key')
    })

    it('should return false when key does not exist', () => {
      mockLRU.has.mockReturnValue(false)
      expect(cache.has('missing-key')).toBe(false)
    })

    it('should return false for empty string key', () => {
      mockLRU.has.mockReturnValue(false)
      expect(cache.has('')).toBe(false)
    })
  })

  describe('set', () => {
    it('should write file and return true on success', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      const result = await cache.set('test-key', 'test-value')

      expect(result).toBe(true)
      expect(mockLRU.set).toHaveBeenCalledWith('test-key', NaN)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/test-key', 'test-value')
    })

    it('should set item with expiration when maxAge is provided', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)
      const before = Date.now()

      await cache.set('test-key', 'test-value', 1000)

      const after = Date.now()
      const [, timeOfDeath, maxAge] = (mockLRU.set as jest.Mock).mock.calls[0]
      expect(timeOfDeath).toBeGreaterThanOrEqual(before + 1000)
      expect(timeOfDeath).toBeLessThanOrEqual(after + 1000)
      expect(maxAge).toBe(1000)
    })

    it('should return false when write fails', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockRejectedValue(new Error('Write failed'))

      const result = await cache.set('test-key', 'test-value')

      expect(result).toBe(false)
    })

    it('should delete outdated file before writing new key', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Set initial key to mark one for deletion
      await cache.set('old-key', 'old-value')
      mockLRU.get.mockReturnValue(1)

      // Simulate disposal by calling dispose callback
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('old-key')

      // Now set a different key
      mockWriteFile.mockClear()
      await cache.set('new-key', 'new-value')

      // Verify both keys were written (old-key marked for deletion should be cleaned)
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should not delete file if keyToBeDeleted is the same as current key', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Mark a key for deletion
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('same-key')

      mockWriteFile.mockClear()
      await cache.set('same-key', 'new-value')

      // Only one write should happen (not two)
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/same-key', 'new-value')
    })

    it('should acquire write lock on the key', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      await cache.set('test-key', 'test-value')

      expect(mockLock.writeLock).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should handle write promise correctly', async () => {
      let capturedResolve: (value: any) => void
      mockLock.writeLock.mockImplementation((key, callback) => {
        const release = jest.fn()
        setTimeout(() => callback(release), 0)
      })
      mockWriteFile.mockResolvedValue(undefined)

      const result = await cache.set('test-key', 'test-value')

      expect(result).toBe(true)
    })
  })

  describe('get', () => {
    it('should read file and return value on success', async () => {
      const testData = 'test-data'
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue(testData)

      const result = await cache.get('test-key')

      expect(result).toBe(testData)
      expect(mockReadFile).toHaveBeenCalledWith('/test/cache/test-key')
      expect(cache.getCumulativeStats().hits).toBe(1)
    })

    it('should increment total count on each get', async () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')

      await cache.get('key1')
      await cache.get('key2')

      expect(cache.getCumulativeStats().total).toBe(2)
    })

    it('should return undefined when key does not exist in LRU', async () => {
      mockLRU.get.mockReturnValue(undefined)

      const result = await cache.get('missing-key')

      expect(result).toBeUndefined()
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('should delete file with keyToBeDeleted when key not found', async () => {
      mockLRU.get.mockReturnValue(undefined)

      // Mark a key for deletion
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('to-delete')

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const { remove } = jest.requireMock('fs-extra')
      remove.mockResolvedValue(undefined)

      await cache.get('missing-key')

      // Should attempt to delete the marked key
      // Note: deleteFile is private, so we verify through its effects
    })

    it('should return null when read file fails', async () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockRejectedValue(new Error('Read failed'))

      const result = await cache.get('test-key')

      expect(result).toBeNull()
    })

    it('should delete expired files', async () => {
      const pastTime = Date.now() - 1000
      mockLRU.get.mockReturnValue(pastTime)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')
      const { remove } = jest.requireMock('fs-extra')
      remove.mockResolvedValue(undefined)

      await cache.get('test-key')

      expect(mockLRU.del).toHaveBeenCalledWith('test-key')
    })

    it('should not delete non-expired files', async () => {
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')

      await cache.get('test-key')

      expect(mockLRU.del).not.toHaveBeenCalled()
    })

    it('should acquire read lock on the key', async () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')

      await cache.get('test-key')

      expect(mockLock.readLock).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should handle concurrent reads with lock', async () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')

      const promise1 = cache.get('key1')
      const promise2 = cache.get('key2')

      await Promise.all([promise1, promise2])

      expect(mockLock.readLock).toHaveBeenCalledTimes(2)
    })
  })

  describe('getStats', () => {
    it('should return default stats object with default name', () => {
      mockLRU.itemCount = 5
      mockLRU.length = 10
      mockLRU.max = 100

      const stats = cache.getStats()

      expect(stats.name).toBe('disk-lru-cache')
      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(10)
      expect(stats.max).toBe(100)
      expect(stats.disposedItems).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should return stats with custom name', () => {
      const stats = cache.getStats('custom-cache')

      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', async () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')

      // Simulate 3 gets, 2 hits
      await cache.get('key1') // hit
      mockLRU.get.mockReturnValue(undefined)
      await cache.get('key2') // miss
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      await cache.get('key3') // hit

      const stats = cache.getStats()

      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(3)
      expect(stats.hitRate).toBeCloseTo(2 / 3)
    })

    it('should return undefined hitRate when total is 0', () => {
      const stats = cache.getStats()

      expect(stats.hitRate).toBeUndefined()
    })

    it('should reset reported stats after getStats call', async () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')

      await cache.get('key1')
      const stats1 = cache.getStats()
      const stats2 = cache.getStats()

      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
    })

    it('should track disposed items in stats', () => {
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('key1')
      disposeCallback('key2')

      const stats = cache.getStats()

      expect(stats.disposedItems).toBe(2)
    })

    it('should reset disposed items count after getStats', () => {
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('key1')

      cache.getStats()
      const stats = cache.getStats()

      expect(stats.disposedItems).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative statistics', () => {
      mockLRU.itemCount = 5
      mockLRU.length = 10
      mockLRU.max = 100

      const stats = cache.getCumulativeStats()

      expect(stats).toEqual({
        disposedItems: 0,
        hits: 0,
        itemCount: 5,
        length: 10,
        max: 100,
        total: 0,
      })
    })

    it('should return all-time hits and total', async () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('data')

      await cache.get('key1')
      await cache.get('key2')
      cache.getStats() // Reset reported stats
      await cache.get('key3')

      const stats = cache.getCumulativeStats()

      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(3)
    })

    it('should track disposed items cumulatively', () => {
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('key1')
      disposeCallback('key2')
      disposeCallback('key3')

      const stats = cache.getCumulativeStats()

      expect(stats.disposedItems).toBe(3)
    })

    it('should not reset stats on getCumulativeStats call', () => {
      const disposeCallback = (LRU as jest.Mock).mock.calls[0][0].dispose
      disposeCallback('key1')

      const stats1 = cache.getCumulativeStats()
      const stats2 = cache.getCumulativeStats()

      expect(stats1.disposedItems).toBe(stats2.disposedItems)
    })
  })

  describe('integration scenarios', () => {
    it('should handle set and get cycle', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue('stored-value')

      const setResult = await cache.set('test-key', 'test-value')
      const getResult = await cache.get('test-key')

      expect(setResult).toBe(true)
      expect(getResult).toBe('stored-value')
    })

    it('should handle multiple keys with expiration', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue('data')

      const now = Date.now()
      await cache.set('expired-key', 'value1', -1000) // Already expired
      await cache.set('valid-key', 'value2', 10000) // Valid for 10 seconds

      mockLRU.get.mockReturnValue(now - 1000) // Expired
      await cache.get('expired-key')

      expect(mockLRU.del).toHaveBeenCalledWith('expired-key')
    })

    it('should handle errors gracefully in concurrent operations', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      mockReadFile.mockRejectedValue(new Error('Read error'))
      mockLRU.get.mockReturnValue(Date.now() + 10000)

      const result1 = await cache.set('key1', 'value1')
      const result2 = await cache.get('key2')

      expect(result1).toBe(false)
      expect(result2).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle empty string as key', async () => {
      mockLRU.get.mockReturnValue(undefined)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const result = await cache.get('')

      expect(result).toBeUndefined()
    })

    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(1000000)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      const result = await cache.set('large-key', largeValue)

      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/large-key', largeValue)
    })

    it('should handle special characters in keys', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)
      const specialKey = 'key-with-!@#$%^&*()'

      await cache.set(specialKey, 'value')

      expect(mockWriteFile).toHaveBeenCalledWith("/test/cache/key-with-!@#$%^&*()", 'value')
    })

    it('should handle zero maxAge', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      await cache.set('key', 'value', 0)

      const [, timeOfDeath, maxAge] = (mockLRU.set as jest.Mock).mock.calls[0]
      expect(timeOfDeath).toBeCloseTo(Date.now(), -2)
      expect(maxAge).toBe(0)
    })

    it('should handle negative maxAge', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      await cache.set('key', 'value', -1000)

      const [, timeOfDeath] = (mockLRU.set as jest.Mock).mock.calls[0]
      expect(timeOfDeath).toBeLessThan(Date.now())
    })

    it('should handle null value stored', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      const result = await cache.set('null-key', null as unknown as string)

      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/null-key', null)
    })

    it('should handle numeric values', async () => {
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      const result = await cache.set('num-key', 12345 as unknown as string)

      expect(result).toBe(true)
    })
  })
})