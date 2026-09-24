import { DiskCache } from './DiskCache'
import * as fsExtra from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('rwlock')

describe('DiskCache', () => {
  let diskCache: DiskCache<string>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockReadLock: jest.Mock
  let mockWriteLockInstance: jest.Mock

  beforeEach(() => {
    // Arrange: Clear all mocks
    jest.clearAllMocks()

    // Setup default mock implementations
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockReadLockInstance = jest.fn()

    ;(ReadWriteLock as jest.Mock).mockImplementation(() => ({
      readLock: mockReadLockInstance,
      writeLock: jest.fn(),
    }))
  })

  describe('constructor', () => {
    it('should initialize with provided cachePath', () => {
      // Arrange & Act
      const cachePath = '/test/cache'
      diskCache = new DiskCache(cachePath)

      // Assert
      expect(diskCache).toBeInstanceOf(DiskCache)
    })

    it('should use provided readFile and writeFile functions', () => {
      // Arrange
      const cachePath = '/test/cache'

      // Act
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)

      // Assert
      expect(diskCache).toBeInstanceOf(DiskCache)
    })

    it('should use fs-extra functions as defaults when not provided', () => {
      // Arrange
      const cachePath = '/test/cache'

      // Act
      diskCache = new DiskCache(cachePath)

      // Assert
      expect(diskCache).toBeInstanceOf(DiskCache)
    })

    it('should initialize ReadWriteLock', () => {
      // Arrange & Act
      diskCache = new DiskCache('/test/cache')

      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should return true when file exists', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      const key = 'test-key'

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(
        join('/test/cache', key)
      )
    })

    it('should return false when file does not exist', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)
      const key = 'nonexistent-key'

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(
        join('/test/cache', key)
      )
    })

    it('should handle empty string key', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)
      const key = ''

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(
        join('/test/cache', key)
      )
    })

    it('should construct correct path with key', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      const cachePath = '/my/cache/path'
      const key = 'my-key'
      const diskCacheInstance = new DiskCache(cachePath, mockReadFile, mockWriteFile)

      // Act
      diskCacheInstance.has(key)

      // Assert
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(
        join(cachePath, key)
      )
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should return stats with default name', () => {
      // Arrange & Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        name: 'disk-cache',
        total: 0,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange & Act
      const stats = diskCache.getStats('custom-cache')

      // Assert
      expect(stats).toEqual({
        hits: 0,
        name: 'custom-cache',
        total: 0,
      })
    })

    it('should calculate incremental stats correctly', () => {
      // Arrange: Manually set hits and total (simulating after get/set operations)
      ;(diskCache as any).hits = 10
      ;(diskCache as any).total = 15
      ;(diskCache as any).reported = { hits: 5, total: 10 }

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 5,
        name: 'disk-cache',
        total: 5,
      })
    })

    it('should reset reported stats after calling getStats', () => {
      // Arrange
      ;(diskCache as any).hits = 20
      ;(diskCache as any).total = 25

      // Act
      diskCache.getStats()
      const stats2 = diskCache.getStats()

      // Assert
      expect(stats2).toEqual({
        hits: 0,
        name: 'disk-cache',
        total: 0,
      })
    })

    it('should handle zero incremental stats', () => {
      // Arrange
      ;(diskCache as any).hits = 10
      ;(diskCache as any).total = 15
      ;(diskCache as any).reported = { hits: 10, total: 15 }

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        name: 'disk-cache',
        total: 0,
      })
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should return cumulative stats', () => {
      // Arrange & Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
      })
    })

    it('should return actual cumulative values', () => {
      // Arrange
      ;(diskCache as any).hits = 42
      ;(diskCache as any).total = 100

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        hits: 42,
        total: 100,
      })
    })

    it('should not reset reported stats', () => {
      // Arrange
      ;(diskCache as any).hits = 10
      ;(diskCache as any).total = 15
      ;(diskCache as any).reported = { hits: 5, total: 10 }

      // Act
      diskCache.getCumulativeStats()
      const reportedAfter = (diskCache as any).reported

      // Assert
      expect(reportedAfter).toEqual({ hits: 5, total: 10 })
    })
  })

  describe('get', () => {
    let mockRelease: jest.Mock

    beforeEach(() => {
      mockRelease = jest.fn()
      diskCache = new DiskCache('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should read file and return data on success', async () => {
      // Arrange
      const key = 'test-key'
      const expectedData = 'cached-value'
      mockReadFile.mockResolvedValue(expectedData)
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBe(expectedData)
      expect(mockReadFile).toHaveBeenCalledWith(
        join('/test/cache', key)
      )
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should increment total on get call', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get(key)
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(1)
    })

    it('should increment hits on successful read', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get(key)
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
    })

    it('should not increment hits on read failure', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get(key)
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should return undefined on read error', async () => {
      // Arrange
      const key = 'nonexistent-key'
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBeNull()
    })

    it('should release lock after successful read', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should release lock on read error', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockRejectedValue(new Error('Read failed'))
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should use read lock for concurrent reads', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockReadLockInstance).toHaveBeenCalledWith(
        key,
        expect.any(Function)
      )
    })

    it('should handle empty string key', async () => {
      // Arrange
      const key = ''
      mockReadFile.mockResolvedValue('data')
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBe('data')
      expect(mockReadFile).toHaveBeenCalledWith(
        join('/test/cache', key)
      )
    })
  })

  describe('set', () => {
    let mockRelease: jest.Mock
    let mockWriteLock: jest.Mock

    beforeEach(() => {
      mockRelease = jest.fn()
      mockWriteLock = jest.fn()
      const lockInstance = {
        readLock: mockReadLockInstance,
        writeLock: mockWriteLock,
      }
      ;(ReadWriteLock as jest.Mock).mockImplementation(() => lockInstance)
      diskCache = new DiskCache('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should write file and return true on success', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/cache', key),
        value
      )
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should return false on write failure', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should release lock after successful write', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should release lock on write error', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should use write lock for concurrent writes', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(mockWriteLock).toHaveBeenCalledWith(
        key,
        expect.any(Function)
      )
    })

    it('should handle complex object values', async () => {
      // Arrange
      const key = 'test-key'
      const value = { foo: 'bar', nested: { baz: 42 } }
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.set(key, value as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/cache', key),
        value
      )
    })

    it('should handle empty string key', async () => {
      // Arrange
      const key = ''
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/cache', key),
        value
      )
    })

    it('should handle null value', async () => {
      // Arrange
      const key = 'test-key'
      const value = null
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const result = await diskCache.set(key, value as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/cache', key),
        value
      )
    })
  })

  describe('integration scenarios', () => {
    let mockRelease: jest.Mock
    let mockWriteLock: jest.Mock

    beforeEach(() => {
      mockRelease = jest.fn()
      mockWriteLock = jest.fn()
      const lockInstance = {
        readLock: mockReadLockInstance,
        writeLock: mockWriteLock,
      }
      ;(ReadWriteLock as jest.Mock).mockImplementation(() => lockInstance)
    })

    it('should track multiple operations correctly', async () => {
      // Arrange
      diskCache = new DiskCache('/test/cache', mockReadFile, mockWriteFile)
      mockReadFile.mockResolvedValue('data1')
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.set('key3', 'value3')
      await diskCache.get('key4')
      const stats = diskCache.getStats()

      // Assert
      expect(stats.total).toBe(3) // 3 gets, 1 set doesn't count
      expect(stats.hits).toBe(2) // 2 successful reads
    })

    it('should handle mixed read/write operations', async () => {
      // Arrange
      diskCache = new DiskCache('/test/cache', mockReadFile, mockWriteFile)
      mockReadFile.mockResolvedValue('cached')
      mockWriteFile.mockResolvedValue(undefined)
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      mockReadLockInstance.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )
      mockWriteLock.mockImplementation(
        (lockKey: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      const hasKey = diskCache.has('key1')
      const getResult = await diskCache.get('key1')
      const setResult = await diskCache.set('key2', 'newvalue')

      // Assert
      expect(hasKey).toBe(true)
      expect(getResult).toBe('cached')
      expect(setResult).toBe(true)
    })
  })
})
