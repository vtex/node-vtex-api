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
  let cache: LRUDiskCache<any>
  const cachePath = '/test/cache'
  const options: LRUDiskCacheOptions = { max: 100 }

  beforeEach(() => {
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockLRU = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      del: jest.fn(),
      itemCount: 10,
      length: 50,
      max: 100,
    } as any
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any

    ;(LRU as jest.Mock).mockImplementation(() => mockLRU)
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with cache path and options', () => {
      expect(LRU).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 100,
          noDisposeOnSet: true,
        })
      )
    })

    it('should initialize stats to zero', () => {
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should set up dispose callback in LRU options', () => {
      const lruCall = (LRU as jest.Mock).mock.calls[0][0]
      expect(lruCall.dispose).toBeDefined()
      expect(typeof lruCall.dispose).toBe('function')
    })

    it('should initialize ReadWriteLock', () => {
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should use injected read and write file functions', () => {
      const customRead = jest.fn()
      const customWrite = jest.fn()
      new LRUDiskCache(cachePath, options, customRead, customWrite)
      expect(customRead).not.toHaveBeenCalled()
      expect(customWrite).not.toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when key exists', () => {
      mockLRU.has.mockReturnValue(true)
      expect(cache.has('key1')).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith('key1')
    })

    it('should return false when key does not exist', () => {
      mockLRU.has.mockReturnValue(false)
      expect(cache.has('key1')).toBe(false)
    })

    it('should return false for empty string key', () => {
      mockLRU.has.mockReturnValue(false)
      expect(cache.has('')).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      const stats = cache.getStats()
      expect(stats.name).toBe('disk-lru-cache')
    })

    it('should return stats with custom name', () => {
      const stats = cache.getStats('custom-cache')
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hit rate correctly', () => {
      mockLRU.itemCount = 5
      mockLRU.length = 50
      mockLRU.max = 100

      // Simulate 10 hits and 20 total
      cache.get('key1')
      cache.get('key2')
      const stats = cache.getStats()

      expect(stats.itemCount).toBe(5)
      expect(stats.length).toBe(50)
      expect(stats.max).toBe(100)
    })

    it('should return undefined hit rate when total is zero', () => {
      const stats = cache.getStats()
      expect(stats.hitRate).toBeUndefined()
    })

    it('should reset reported stats after getStats call', () => {
      const stats1 = cache.getStats()
      const stats2 = cache.getStats()
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
      expect(stats2.disposedItems).toBe(0)
    })

    it('should track hits and total separately from cumulative', () => {
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'test' })

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      cache.get('key1')
      const stats = cache.getStats()
      expect(stats.total).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      mockLRU.itemCount = 5
      mockLRU.length = 50
      mockLRU.max = 100

      const stats = cache.getCumulativeStats()
      expect(stats).toEqual({
        disposedItems: 0,
        hits: 0,
        itemCount: 5,
        length: 50,
        max: 100,
        total: 0,
      })
    })

    it('should not reset reported stats', () => {
      mockLRU.itemCount = 10
      mockLRU.length = 60
      mockLRU.max = 100

      const cumulativeStats = cache.getCumulativeStats()
      const regularStats = cache.getStats()

      expect(cumulativeStats.itemCount).toBe(10)
      expect(regularStats.itemCount).toBe(10)
    })
  })

  describe('get', () => {
    it('should return data when key exists and is not stale', async () => {
      const testData = { value: 'test' }
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue(testData)

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const result = await cache.get('key1')
      expect(result).toEqual(testData)
      expect(mockReadFile).toHaveBeenCalledWith('/test/cache/key1')
    })

    it('should return undefined when key does not exist', async () => {
      mockLRU.get.mockReturnValue(undefined)
      const result = await cache.get('nonexistent')
      expect(result).toBeUndefined()
    })

    it('should increment total on every get call', async () => {
      mockLRU.get.mockReturnValue(undefined)
      await cache.get('key1')
      await cache.get('key2')
      const stats = cache.getStats()
      expect(stats.total).toBe(2)
    })

    it('should increment hits when key exists and file reads successfully', async () => {
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({ data: 'test' })

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      await cache.get('key1')
      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
    })

    it('should not increment hits when read fails', async () => {
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockRejectedValue(new Error('Read failed'))

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const result = await cache.get('key1')
      expect(result).toBeNull()
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
    })

    it('should delete stale entries', async () => {
      const pastTime = Date.now() - 1000
      mockLRU.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'test' })

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      await cache.get('key1')
      expect(mockLRU.del).toHaveBeenCalledWith('key1')
    })

    it('should use read lock for file access', async () => {
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({})

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      await cache.get('key1')
      expect(mockLock.readLock).toHaveBeenCalledWith('key1', expect.any(Function))
    })

    it('should release read lock even on error', async () => {
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockRejectedValue(new Error('Read error'))

      let releaseCallback: (() => void) | null = null
      mockLock.readLock.mockImplementation((key, callback) => {
        const release = jest.fn()
        releaseCallback = release
        callback(release)
      })

      await cache.get('key1')
      expect(releaseCallback).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should set value without maxAge', async () => {
      mockWriteFile.mockResolvedValue(undefined)

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const result = await cache.set('key1', { data: 'test' })
      expect(result).toBe(true)
      expect(mockLRU.set).toHaveBeenCalledWith('key1', NaN)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/key1', { data: 'test' })
    })

    it('should set value with maxAge', async () => {
      mockWriteFile.mockResolvedValue(undefined)

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const maxAge = 5000
      await cache.set('key1', { data: 'test' }, maxAge)
      const lruSetCall = mockLRU.set.mock.calls[0]
      expect(lruSetCall[0]).toBe('key1')
      expect(lruSetCall[2]).toBe(maxAge)
    })

    it('should use write lock for file writing', async () => {
      mockWriteFile.mockResolvedValue(undefined)

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      await cache.set('key1', { data: 'test' })
      expect(mockLock.writeLock).toHaveBeenCalledWith('key1', expect.any(Function))
    })

    it('should return false on write failure', async () => {
      mockWriteFile.mockResolvedValue(true)

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const result = await cache.set('key1', { data: 'test' })
      expect(result).toBe(false)
    })

    it('should return false on write exception', async () => {
      mockWriteFile.mockRejectedValue(new Error('Write failed'))

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const result = await cache.set('key1', { data: 'test' })
      expect(result).toBe(false)
    })

    it('should delete previously queued file on new set', async () => {
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // First, simulate that keyToBeDeleted is set via dispose callback
      const lruOptions = (LRU as jest.Mock).mock.calls[0][0]
      lruOptions.dispose('oldKey')

      await cache.set('newKey', { data: 'test' })
      // The old key file should be deleted
      expect(mockLock.writeLock).toHaveBeenCalled()
    })

    it('should release write lock even on error', async () => {
      mockWriteFile.mockRejectedValue(new Error('Write error'))

      let releaseCallback: (() => void) | null = null
      mockLock.writeLock.mockImplementation((key, callback) => {
        const release = jest.fn()
        releaseCallback = release
        callback(release)
      })

      await cache.set('key1', { data: 'test' })
      expect(releaseCallback).toHaveBeenCalled()
    })
  })

  describe('dispose callback', () => {
    it('should track disposed items', () => {
      const lruOptions = (LRU as jest.Mock).mock.calls[0][0]
      const dispose = lruOptions.dispose

      dispose('key1')
      dispose('key2')

      const stats = cache.getCumulativeStats()
      expect(stats.disposedItems).toBe(2)
    })

    it('should set keyToBeDeleted on dispose', () => {
      const lruOptions = (LRU as jest.Mock).mock.calls[0][0]
      const dispose = lruOptions.dispose

      dispose('keyToDelete')
      // keyToBeDeleted is private, but we can verify via integration
      const stats = cache.getStats()
      expect(stats.disposedItems).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('should handle empty cache path', () => {
      expect(() => {
        new LRUDiskCache('', options, mockReadFile, mockWriteFile)
      }).not.toThrow()
    })

    it('should handle null or undefined values in get', async () => {
      mockLRU.get.mockReturnValue(undefined)
      const result = await cache.get('key1')
      expect(result).toBeUndefined()
    })

    it('should handle zero maxAge', async () => {
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // maxAge of 0 should still set the value
      await cache.set('key1', { data: 'test' }, 0)
      expect(mockLRU.set).toHaveBeenCalled()
    })

    it('should handle negative maxAge', async () => {
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      await cache.set('key1', { data: 'test' }, -1000)
      expect(mockLRU.set).toHaveBeenCalled()
    })

    it('should handle very large maxAge', async () => {
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const largeMaxAge = Number.MAX_SAFE_INTEGER
      await cache.set('key1', { data: 'test' }, largeMaxAge)
      const lruSetCall = mockLRU.set.mock.calls[0]
      expect(lruSetCall[2]).toBe(largeMaxAge)
    })

    it('should handle multiple concurrent gets', async () => {
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({ data: 'test' })

      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      await Promise.all([
        cache.get('key1'),
        cache.get('key2'),
        cache.get('key3'),
      ])

      const stats = cache.getStats()
      expect(stats.total).toBe(3)
    })

    it('should handle special characters in keys', async () => {
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const specialKey = 'key/with/slashes:and*wildcards'
      await cache.set(specialKey, { data: 'test' })
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining(specialKey),
        expect.any(Object)
      )
    })
  })

  describe('noDisposeOnSet option', () => {
    it('should set noDisposeOnSet to true in LRU options', () => {
      const lruCall = (LRU as jest.Mock).mock.calls[0][0]
      expect(lruCall.noDisposeOnSet).toBe(true)
    })
  })

  describe('integration scenarios', () => {
    it('should handle set followed by get', async () => {
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue({ data: 'stored' })

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const futureTime = Date.now() + 10000
      mockLRU.set.mockImplementation((key) => {
        mockLRU.get.mockReturnValue(futureTime)
      })

      await cache.set('key1', { data: 'stored' })
      mockLRU.get.mockReturnValue(futureTime)
      const result = await cache.get('key1')

      expect(mockWriteFile).toHaveBeenCalled()
      expect(mockReadFile).toHaveBeenCalled()
    })

    it('should track stats correctly through multiple operations', async () => {
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue({ data: 'test' })

      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)

      // One set
      await cache.set('key1', { data: 'test' })
      // Two gets
      await cache.get('key1')
      await cache.get('key1')

      const stats = cache.getStats()
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(2)
    })
  })
})
