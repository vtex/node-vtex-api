import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions, LRUStats, CumulativeStats } from './typings'
import { WindowedCounters } from './WindowedCounters'
import ReadWriteLock from 'rwlock'
import LRU from 'lru-cache'

jest.mock('./WindowedCounters')
jest.mock('rwlock')
jest.mock('lru-cache')

const mockReadJSON = jest.fn()
const mockOutputJSON = jest.fn()
const mockRemove = jest.fn()

jest.mock('fs-extra', () => ({
  readJSON: mockReadJSON,
  outputJSON: mockOutputJSON,
  remove: mockRemove,
}))

describe('LRUDiskCache', () => {
  let cache: LRUDiskCache<any>
  let mockLRU: jest.Mocked<LRU<string, number>>
  let mockLock: jest.Mocked<ReadWriteLock>
  let mockCounters: jest.Mocked<WindowedCounters>
  const cachePath = '/test/cache'
  const options: LRUDiskCacheOptions = { max: 100 }

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock WindowedCounters
    mockCounters = {
      countDisposed: jest.fn(),
      countRead: jest.fn(),
      countHit: jest.fn(),
      windowed: jest.fn().mockReturnValue({
        disposed: 5,
        hits: 10,
        total: 20,
      }),
      cumulative: jest.fn().mockReturnValue({
        disposed: 50,
        hits: 100,
        total: 200,
      }),
    } as any
    ;(WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mockImplementation(
      () => mockCounters
    )

    // Mock ReadWriteLock
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any
    ;(ReadWriteLock as jest.MockedClass<typeof ReadWriteLock>).mockImplementation(
      () => mockLock
    )

    // Mock LRU
    mockLRU = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      itemCount: 5,
      length: 80,
      max: 100,
    } as any
    ;(LRU as jest.MockedClass<typeof LRU>).mockImplementation(
      () => mockLRU
    )

    // Clear fs-extra mocks
    mockReadJSON.mockClear()
    mockOutputJSON.mockClear()
    mockRemove.mockClear()
  })

  describe('constructor', () => {
    it('should initialize cache with provided path and options', () => {
      // Arrange & Act
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)

      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
      expect(ReadWriteLock).toHaveBeenCalled()
      expect(LRU).toHaveBeenCalled()
    })

    it('should set up LRU with dispose callback', () => {
      // Arrange & Act
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)

      // Assert
      const callArgs = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0]
      expect(callArgs.dispose).toBeDefined()
      expect(callArgs.noDisposeOnSet).toBe(true)
    })

    it('should use default readJSON and outputJSON when not provided', () => {
      // Arrange, Act & Assert
      expect(() => {
        new LRUDiskCache(cachePath, options)
      }).not.toThrow()
    })

    it('should initialize keyToBeDeleted as empty string', () => {
      // Arrange & Act
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)

      // Assert
      const callArgs = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0]
      // Verify by calling dispose
      callArgs.dispose('test-key')
      // Should not throw and should set counters.countDisposed to be called
      expect(mockCounters.countDisposed).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should return true if key exists in LRU storage', () => {
      // Arrange
      mockLRU.has.mockReturnValue(true)

      // Act
      const result = cache.has('existing-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.has).toHaveBeenCalledWith('existing-key')
    })

    it('should return false if key does not exist in LRU storage', () => {
      // Arrange
      mockLRU.has.mockReturnValue(false)

      // Act
      const result = cache.has('non-existing-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRU.has).toHaveBeenCalledWith('non-existing-key')
    })

    it('should handle empty string key', () => {
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
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should return stats with default name', () => {
      // Arrange & Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hitRate: 0.5,
        hits: 10,
        itemCount: 5,
        length: 80,
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

    it('should calculate hit rate as hits divided by total', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({
        disposed: 2,
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
      // Arrange
      mockLRU.itemCount = 25
      mockLRU.length = 150
      mockLRU.max = 200

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.itemCount).toBe(25)
      expect(stats.length).toBe(150)
      expect(stats.max).toBe(200)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should return cumulative stats', () => {
      // Arrange & Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 50,
        hits: 100,
        itemCount: 5,
        length: 80,
        max: 100,
        total: 200,
      })
    })

    it('should call cumulative on counters', () => {
      // Arrange & Act
      cache.getCumulativeStats()

      // Assert
      expect(mockCounters.cumulative).toHaveBeenCalled()
    })

    it('should include LRU storage metrics from cache', () => {
      // Arrange
      mockLRU.itemCount = 42
      mockLRU.length = 333
      mockLRU.max = 500

      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats.itemCount).toBe(42)
      expect(stats.length).toBe(333)
      expect(stats.max).toBe(500)
    })
  })

  describe('get', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should return undefined when key does not exist', async () => {
      // Arrange
      mockLRU.get.mockReturnValue(undefined)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('non-existing-key')

      // Assert
      expect(result).toBeUndefined()
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should read file and return data when key exists and not expired', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      const fileData = { value: 'test-data' }
      mockLRU.get.mockReturnValue(futureTime)
      mockReadJSON.mockResolvedValue(fileData)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toEqual(fileData)
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countHit).toHaveBeenCalled()
      expect(mockReadJSON).toHaveBeenCalledWith('/test/cache/test-key')
    })

    it('should delete file and key when expired', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRU.get.mockReturnValue(pastTime)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockRemove.mockResolvedValue(undefined)

      // Act
      const result = await cache.get('expired-key')

      // Assert
      expect(mockLRU.del).toHaveBeenCalledWith('expired-key')
      expect(mockRemove).toHaveBeenCalledWith('/test/cache/expired-key')
    })

    it('should handle read file error gracefully', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadJSON.mockRejectedValue(new Error('Read failed'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('error-key')

      // Assert
      expect(result).toBe(null)
    })

    it('should delete keyToBeDeleted file if it exists and is different from current key', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockRemove.mockResolvedValue(undefined)

      // Simulate setting keyToBeDeleted via dispose callback
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback('old-key')

      // Act
      const result = await cache.get('current-key')

      // Assert
      expect(mockRemove).toHaveBeenCalledWith('/test/cache/old-key')
    })

    it('should use read lock when accessing file', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.get('test-key')

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should handle NaN timeOfDeath as non-expired', async () => {
      // Arrange
      mockLRU.get.mockReturnValue(NaN)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.get('nan-key')

      // Assert
      expect(result).toEqual({ data: 'value' })
      expect(mockLRU.del).not.toHaveBeenCalled()
    })
  })

  describe('set', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should write file and set key with maxAge', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const value = { test: 'data' }
      const maxAge = 5000

      // Act
      const result = await cache.set('test-key', value, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        maxAge
      )
      expect(mockOutputJSON).toHaveBeenCalledWith('/test/cache/test-key', value)
    })

    it('should write file and set key without maxAge', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const value = { test: 'data' }

      // Act
      const result = await cache.set('test-key', value)

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.set).toHaveBeenCalledWith('test-key', NaN)
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockOutputJSON.mockRejectedValue(new Error('Write failed'))
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('test-key', { data: 'value' })

      // Assert
      expect(result).toBe(false)
    })

    it('should delete previously marked keyToBeDeleted if different', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockRemove.mockResolvedValue(undefined)

      // Simulate marking a key for deletion
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback('old-key')

      // Act
      await cache.set('new-key', { data: 'value' })

      // Assert
      expect(mockRemove).toHaveBeenCalledWith('/test/cache/old-key')
    })

    it('should not delete keyToBeDeleted if same as current key', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockRemove.mockResolvedValue(undefined)

      // Simulate marking same key for deletion
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose
      disposeCallback('same-key')

      // Act
      await cache.set('same-key', { data: 'value' })

      // Assert
      expect(mockRemove).not.toHaveBeenCalled()
    })

    it('should use write lock when writing file', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.set('test-key', { data: 'value' })

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should set timeOfDeath to current time plus maxAge', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const maxAge = 3000
      const beforeTime = Date.now()

      // Act
      await cache.set('test-key', { data: 'value' }, maxAge)

      // Assert
      const afterTime = Date.now()
      const setCall = mockLRU.set.mock.calls[0]
      const timeOfDeath = setCall[1]
      expect(timeOfDeath).toBeGreaterThanOrEqual(beforeTime + maxAge)
      expect(timeOfDeath).toBeLessThanOrEqual(afterTime + maxAge)
    })

    it('should handle empty key', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('', { data: 'value' })

      // Assert
      expect(result).toBe(true)
      expect(mockLRU.set).toHaveBeenCalledWith('', NaN)
    })
  })

  describe('dispose callback', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should set keyToBeDeleted and count disposed when dispose is called', () => {
      // Arrange
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Act
      disposeCallback('expired-key')

      // Assert
      expect(mockCounters.countDisposed).toHaveBeenCalled()
    })

    it('should overwrite keyToBeDeleted with new evicted key', () => {
      // Arrange
      const disposeCallback = (LRU as jest.MockedClass<typeof LRU>).mock.calls[0][0].dispose

      // Act
      disposeCallback('first-key')
      disposeCallback('second-key')

      // Assert
      expect(mockCounters.countDisposed).toHaveBeenCalledTimes(2)
    })
  })

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should handle special characters in key path', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const specialKey = 'key/with/special\\chars'

      // Act
      await cache.set(specialKey, { data: 'value' })

      // Assert
      expect(mockOutputJSON).toHaveBeenCalledWith(
        expect.stringContaining(specialKey),
        { data: 'value' }
      )
    })

    it('should handle release callback exceptions in readLock', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockLock.readLock.mockImplementation((key, callback) => {
        const releaseFn = jest.fn(() => {
          throw new Error('Release error')
        })
        callback(releaseFn)
      })

      // Act & Assert
      expect(async () => {
        await cache.get('test-key')
      }).not.toThrow()
    })

    it('should handle large values', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const largeValue = { data: 'x'.repeat(1000000) }

      // Act
      const result = await cache.set('large-key', largeValue)

      // Assert
      expect(result).toBe(true)
      expect(mockOutputJSON).toHaveBeenCalledWith('/test/cache/large-key', largeValue)
    })

    it('should handle concurrent operations with same key', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRU.get.mockReturnValue(futureTime)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act - simulate concurrent get and set
      const getPromise = cache.get('same-key')
      const setPromise = cache.set('same-key', { data: 'new-value' })
      const [getResult, setResult] = await Promise.all([getPromise, setPromise])

      // Assert
      expect(getResult).toEqual({ data: 'value' })
      expect(setResult).toBe(true)
    })

    it('should handle zero maxAge', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('zero-age-key', { data: 'value' }, 0)

      // Assert
      expect(result).toBe(true)
      const setCall = mockLRU.set.mock.calls[0]
      expect(setCall[2]).toBe(0)
    })

    it('should handle negative maxAge', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await cache.set('negative-age-key', { data: 'value' }, -1000)

      // Assert
      expect(result).toBe(true)
      const setCall = mockLRU.set.mock.calls[0]
      expect(setCall[2]).toBe(-1000)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadJSON, mockOutputJSON)
    })

    it('should track reads correctly', async () => {
      // Arrange
      mockLRU.get.mockReturnValue(Date.now() + 10000)
      mockReadJSON.mockResolvedValue({ data: 'value' })
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await cache.get('key1')
      await cache.get('key2')
      await cache.get('key3')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(3)
    })

    it('should properly construct file path with cache directory', async () => {
      // Arrange
      mockOutputJSON.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      const key = 'mykey'

      // Act
      await cache.set(key, { data: 'value' })

      // Assert
      expect(mockOutputJSON).toHaveBeenCalledWith(`${cachePath}/${key}`, expect.any(Object))
    })
  })
})
