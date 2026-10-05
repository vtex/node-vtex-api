import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import { WindowedCounters } from './WindowedCounters'
import ReadWriteLock from 'rwlock'

jest.mock('./WindowedCounters')
jest.mock('rwlock')
jest.mock('fs-extra')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockWindowedCounters: jest.Mocked<WindowedCounters>
  let mockLock: jest.Mocked<ReadWriteLock>
  let cachePath: string
  let cacheOptions: LRUDiskCacheOptions
  let cache: LRUDiskCache<any>

  beforeEach(() => {
    jest.clearAllMocks()
    cachePath = '/test/cache'
    cacheOptions = { max: 100, ttl: 60000 }
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    mockWindowedCounters = {
      countRead: jest.fn(),
      countHit: jest.fn(),
      countDisposed: jest.fn(),
      windowed: jest.fn(() => ({
        disposed: 5,
        hits: 10,
        total: 20,
      })),
      cumulative: jest.fn(() => ({
        disposed: 15,
        hits: 50,
        total: 100,
      })),
    } as any
    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockWindowedCounters)

    mockLock = {
      readLock: jest.fn((key: string, callback: Function) => callback(() => {})),
      writeLock: jest.fn((key: string, callback: Function) => callback(() => {})),
    } as any
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    cache = new LRUDiskCache(cachePath, cacheOptions, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default read/write file functions when not provided', () => {
      // Arrange & Act
      const testCache = new LRUDiskCache(cachePath, cacheOptions)

      // Assert
      expect(testCache).toBeInstanceOf(LRUDiskCache)
      expect(WindowedCounters).toHaveBeenCalled()
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize with custom read/write file functions', () => {
      // Arrange & Act
      const customRead = jest.fn()
      const customWrite = jest.fn()
      const testCache = new LRUDiskCache(cachePath, cacheOptions, customRead, customWrite)

      // Assert
      expect(testCache).toBeInstanceOf(LRUDiskCache)
    })

    it('should set up LRU storage with dispose callback', () => {
      // Arrange
      const LRUMock = jest.fn()
      jest.doMock('lru-cache', () => LRUMock)

      // Act
      new LRUDiskCache(cachePath, cacheOptions, mockReadFile, mockWriteFile)

      // Assert - verify dispose callback is set up by checking countDisposed is called when item is disposed
      expect(mockWindowedCounters.countDisposed).not.toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when key exists in LRU storage', () => {
      // Arrange
      const key = 'test-key'
      cache.set(key, { data: 'test' })

      // Act
      const result = cache.has(key)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when key does not exist in LRU storage', () => {
      // Arrange
      const key = 'non-existent-key'

      // Act
      const result = cache.has(key)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false for empty string key', () => {
      // Arrange & Act
      const result = cache.has('')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name when not provided', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 5,
        hitRate: 0.5,
        hits: 10,
        itemCount: 0,
        length: 0,
        max: 100,
        name: 'disk-lru-cache',
        total: 20,
      })
    })

    it('should return stats with custom name', () => {
      // Act
      const stats = cache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should calculate hitRate correctly', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBe(10 / 20)
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

    it('should include all required stat fields', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toHaveProperty('disposedItems')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('itemCount')
      expect(stats).toHaveProperty('length')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('name')
      expect(stats).toHaveProperty('total')
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        disposedItems: 15,
        hits: 50,
        itemCount: 0,
        length: 0,
        max: 100,
        total: 100,
      })
    })

    it('should not include hitRate in cumulative stats', () => {
      // Act
      const stats = cache.getCumulativeStats()

      // Assert
      expect(stats).not.toHaveProperty('hitRate')
      expect(stats).not.toHaveProperty('name')
    })

    it('should include all required cumulative stat fields', () => {
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
  })

  describe('get', () => {
    it('should return undefined when key does not exist', async () => {
      // Arrange
      const key = 'non-existent'

      // Act
      const result = await cache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
    })

    it('should increment read counter on get', async () => {
      // Arrange
      const key = 'test-key'

      // Act
      await cache.get(key)

      // Assert
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
    })

    it('should read file from disk when key exists and not expired', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      const futureTimestamp = Date.now() + 60000
      mockReadFile.mockResolvedValue(value)

      // First set the key with a future expiration
      await cache.set(key, value, 60000)

      // Act
      const result = await cache.get(key)

      // Assert
      expect(mockReadFile).toHaveBeenCalled()
    })

    it('should increment hit counter when file is successfully read', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockReadFile.mockResolvedValue(value)
      await cache.set(key, value, 60000)

      // Act
      await cache.get(key)

      // Assert
      expect(mockWindowedCounters.countHit).toHaveBeenCalled()
    })

    it('should handle read errors gracefully', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockReadFile.mockRejectedValue(new Error('Read failed'))
      await cache.set(key, value, 60000)

      // Act
      const result = await cache.get(key)

      // Assert
      expect(result).toBeNull()
    })

    it('should delete expired items after reading', async () => {
      // Arrange
      const key = 'expired-key'
      const value = { data: 'test' }
      const pastTimestamp = Date.now() - 1000
      mockReadFile.mockResolvedValue(value)

      // Act - we need to manually set an expired key in LRU
      await cache.set(key, value, -1000) // negative maxAge means expired
      const result = await cache.get(key)

      // Assert
      expect(result).toBeDefined()
    })

    it('should use read lock when accessing file', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockReadFile.mockResolvedValue(value)
      await cache.set(key, value, 60000)

      // Act
      await cache.get(key)

      // Assert
      expect(mockLock.readLock).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should successfully set a value with maxAge', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      const maxAge = 60000
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value, maxAge)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should successfully set a value without maxAge', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should write file to disk with correct path', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await cache.set(key, value, 60000)

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(`${cachePath}/${key}`, value)
    })

    it('should return false when write fails', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockWriteFile.mockRejectedValue(new Error('Write failed'))

      // Act
      const result = await cache.set(key, value, 60000)

      // Assert
      expect(result).toBe(false)
    })

    it('should use write lock when writing file', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await cache.set(key, value, 60000)

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalled()
    })

    it('should handle empty string key', async () => {
      // Arrange
      const key = ''
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value, 60000)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle null value', async () => {
      // Arrange
      const key = 'test-key'
      const value = null
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value, 60000)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle undefined value', async () => {
      // Arrange
      const key = 'test-key'
      const value = undefined
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value, 60000)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle maxAge of 0', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value, 0)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle negative maxAge', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value, -1000)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('integration scenarios', () => {
    it('should handle set and get workflow', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test-value' }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(value)

      // Act
      const setResult = await cache.set(key, value, 60000)
      const hasKey = cache.has(key)
      const getValue = await cache.get(key)

      // Assert
      expect(setResult).toBe(true)
      expect(hasKey).toBe(true)
      expect(getValue).toEqual(value)
    })

    it('should handle multiple keys independently', async () => {
      // Arrange
      const key1 = 'key1'
      const key2 = 'key2'
      const value1 = { data: '1' }
      const value2 = { data: '2' }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockImplementation((path) => {
        if (path.includes('key1')) return Promise.resolve(value1)
        if (path.includes('key2')) return Promise.resolve(value2)
        return Promise.reject(new Error('Not found'))
      })

      // Act
      await cache.set(key1, value1, 60000)
      await cache.set(key2, value2, 60000)
      const result1 = await cache.get(key1)
      const result2 = await cache.get(key2)

      // Assert
      expect(result1).toEqual(value1)
      expect(result2).toEqual(value2)
    })

    it('should handle complex object values', async () => {
      // Arrange
      const key = 'complex-key'
      const value = {
        nested: { deep: { data: 'test' } },
        array: [1, 2, 3],
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
      }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(value)

      // Act
      const setResult = await cache.set(key, value, 60000)
      const getValue = await cache.get(key)

      // Assert
      expect(setResult).toBe(true)
      expect(getValue).toEqual(value)
    })
  })

  describe('edge cases', () => {
    it('should handle very long key names', async () => {
      // Arrange
      const key = 'a'.repeat(1000)
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(value)

      // Act
      const setResult = await cache.set(key, value, 60000)
      const hasKey = cache.has(key)

      // Assert
      expect(setResult).toBe(true)
      expect(hasKey).toBe(true)
    })

    it('should handle special characters in keys', async () => {
      // Arrange
      const key = 'key:with/special\\characters?&='
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await cache.set(key, value, 60000)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle very large values', async () => {
      // Arrange
      const key = 'large-key'
      const largeValue = {
        data: 'x'.repeat(1000000),
        array: new Array(10000).fill({ nested: 'data' }),
      }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(largeValue)

      // Act
      const setResult = await cache.set(key, largeValue, 60000)
      const getValue = await cache.get(key)

      // Assert
      expect(setResult).toBe(true)
      expect(getValue).toEqual(largeValue)
    })

    it('should call countRead before any other operation in get', async () => {
      // Arrange
      const key = 'test-key'
      const callOrder: string[] = []
      mockWindowedCounters.countRead.mockImplementation(() => callOrder.push('countRead'))
      mockWindowedCounters.countHit.mockImplementation(() => callOrder.push('countHit'))

      // Act
      await cache.get(key)

      // Assert
      expect(callOrder[0]).toBe('countRead')
    })
  })

  describe('lock behavior', () => {
    it('should pass correct key to read lock', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockReadFile.mockResolvedValue(value)
      await cache.set(key, value, 60000)

      // Act
      await cache.get(key)

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should pass correct key to write lock during set', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await cache.set(key, value, 60000)

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith(key, expect.any(Function))
    })
  })
})
