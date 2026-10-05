import { DiskCache } from './DiskCache'
import { WindowedCounters } from './WindowedCounters'
import { pathExistsSync } from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('rwlock')
jest.mock('./WindowedCounters')

describe('DiskCache', () => {
  let diskCache: DiskCache<string>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLock: jest.Mocked<ReadWriteLock>
  let mockCounters: jest.Mocked<WindowedCounters>
  const cachePath = '/test/cache'

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock counters
    mockCounters = {
      countRead: jest.fn(),
      countHit: jest.fn(),
      windowed: jest.fn().mockReturnValue({ hits: 5, total: 10 }),
      cumulative: jest.fn().mockReturnValue({ hits: 50, total: 100 }),
    } as unknown as jest.Mocked<WindowedCounters>
    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockCounters)

    // Setup mock lock
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as unknown as jest.Mocked<ReadWriteLock>
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    // Setup mock file operations
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default file operations when not provided', () => {
      // Arrange & Act
      const cache = new DiskCache(cachePath)

      // Assert
      expect(cache).toBeInstanceOf(DiskCache)
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize with custom read and write file functions', () => {
      // Arrange, Act & Assert
      expect(diskCache).toBeInstanceOf(DiskCache)
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should create a new WindowedCounters instance', () => {
      // Arrange, Act & Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when file exists at key path', () => {
      // Arrange
      const key = 'test-key'
      const expectedPath = join(cachePath, key)
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(pathExistsSync).toHaveBeenCalledWith(expectedPath)
    })

    it('should return false when file does not exist at key path', () => {
      // Arrange
      const key = 'nonexistent-key'
      const expectedPath = join(cachePath, key)
      ;(pathExistsSync as jest.Mock).mockReturnValue(false)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(pathExistsSync).toHaveBeenCalledWith(expectedPath)
    })

    it('should handle empty string key', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(false)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(false)
      expect(pathExistsSync).toHaveBeenCalledWith(cachePath)
    })

    it('should handle nested path keys', () => {
      // Arrange
      const key = 'nested/path/to/key'
      const expectedPath = join(cachePath, key)
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(pathExistsSync).toHaveBeenCalledWith(expectedPath)
    })
  })

  describe('getStats', () => {
    it('should return disk stats with default name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 5, total: 10 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 5,
        total: 10,
        name: 'disk-cache',
      })
      expect(mockCounters.windowed).toHaveBeenCalled()
    })

    it('should return disk stats with custom name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 3, total: 20 })
      const customName = 'my-cache'

      // Act
      const stats = diskCache.getStats(customName)

      // Assert
      expect(stats).toEqual({
        hits: 3,
        total: 20,
        name: customName,
      })
    })

    it('should return stats with zero hits and total', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 0, total: 0 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({ hits: 50, total: 100 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        hits: 50,
        total: 100,
      })
      expect(mockCounters.cumulative).toHaveBeenCalled()
    })

    it('should return cumulative stats with zero values', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({ hits: 0, total: 0 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should return different values from windowed stats', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 5, total: 10 })
      mockCounters.cumulative.mockReturnValue({ hits: 50, total: 100 })

      // Act
      const windowed = diskCache.getStats()
      const cumulative = diskCache.getCumulativeStats()

      // Assert
      expect(cumulative.hits).not.toBe(windowed.hits)
      expect(cumulative.total).not.toBe(windowed.total)
    })
  })

  describe('get', () => {
    it('should retrieve data successfully and count as hit', async () => {
      // Arrange
      const key = 'test-key'
      const expectedData = 'test-value'
      const expectedPath = join(cachePath, key)
      mockReadFile.mockResolvedValue(expectedData)
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBe(expectedData)
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countHit).toHaveBeenCalled()
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath)
    })

    it('should return undefined when file read fails', async () => {
      // Arrange
      const key = 'missing-key'
      const expectedPath = join(cachePath, key)
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBeNull()
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countHit).not.toHaveBeenCalled()
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath)
    })

    it('should count read even when file does not exist', async () => {
      // Arrange
      const key = 'missing-key'
      mockReadFile.mockRejectedValue(new Error('Not found'))
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should use read lock with correct key', async () => {
      // Arrange
      const key = 'locked-key'
      mockReadFile.mockResolvedValue('data')
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should release lock even when error occurs', async () => {
      // Arrange
      const key = 'test-key'
      const releaseFn = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Read error'))
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release lock on successful read', async () => {
      // Arrange
      const key = 'test-key'
      const releaseFn = jest.fn()
      mockReadFile.mockResolvedValue('data')
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should handle empty string key', async () => {
      // Arrange
      const expectedPath = cachePath
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get('')

      // Assert
      expect(result).toBe('value')
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath)
    })

    it('should return complex data structures', async () => {
      // Arrange
      const key = 'complex-key'
      const complexData = { nested: { value: 123 }, array: [1, 2, 3] }
      mockReadFile.mockResolvedValue(complexData)
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toEqual(complexData)
    })
  })

  describe('set', () => {
    it('should write data successfully', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const expectedPath = join(cachePath, key)
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, value)
    })

    it('should return false when write fails', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should use write lock with correct key', async () => {
      // Arrange
      const key = 'locked-key'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.set(key, 'value')

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should release lock on successful write', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.set('key', 'value')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release lock when write fails', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.set('key', 'value')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should write complex data structures', async () => {
      // Arrange
      const key = 'complex-key'
      const complexData = { nested: { value: 123 }, array: [1, 2, 3] }
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, complexData)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), complexData)
    })

    it('should handle empty string key', async () => {
      // Arrange
      const expectedPath = cachePath
      const value = 'value'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.set('', value)

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, value)
    })

    it('should handle null values', async () => {
      // Arrange
      const key = 'null-key'
      const value = null
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), null)
    })

    it('should handle empty string values', async () => {
      // Arrange
      const key = 'empty-value-key'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, '')

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), '')
    })
  })

  describe('getPathKey', () => {
    it('should construct correct path for simple key', () => {
      // Arrange
      const key = 'simple-key'
      const expectedPath = join(cachePath, key)

      // Act
      const result = diskCache.has(key)
      
      // Assert - verify through pathExistsSync call
      expect(pathExistsSync).toHaveBeenCalledWith(expectedPath)
    })

    it('should handle nested paths correctly', () => {
      // Arrange
      const key = 'nested/path/to/key'
      const expectedPath = join(cachePath, key)

      // Act
      diskCache.has(key)

      // Assert
      expect(pathExistsSync).toHaveBeenCalledWith(expectedPath)
    })
  })

  describe('integration scenarios', () => {
    it('should track read count across multiple gets', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.get('key3')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(3)
    })

    it('should track hits only on successful reads', async () => {
      // Arrange
      mockReadFile.mockResolvedValueOnce('data')
      mockReadFile.mockRejectedValueOnce(new Error('Not found'))
      mockReadFile.mockResolvedValueOnce('data')
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.get('key3')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(3)
      expect(mockCounters.countHit).toHaveBeenCalledTimes(2)
    })

    it('should handle concurrent get and set operations with locking', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((k, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((k, callback) => {
        callback(() => {})
      })

      // Act
      const getPromise = diskCache.get('key')
      const setPromise = diskCache.set('key', 'value')
      await Promise.all([getPromise, setPromise])

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledTimes(1)
      expect(mockLock.writeLock).toHaveBeenCalledTimes(1)
    })
  })
})
