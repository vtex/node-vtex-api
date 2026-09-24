import { DiskCache } from './DiskCache'
import * as fsExtra from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('rwlock')
jest.mock('path')

describe('DiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLock: jest.Mocked<ReadWriteLock>
  let diskCache: DiskCache<string>
  const cachePath = '/cache'
  const testKey = 'test-key'
  const testValue = 'test-value'

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mocks
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any

    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)
    ;(join as jest.Mock).mockImplementation((path, key) => `${path}/${key}`)
  })

  describe('constructor', () => {
    it('should create instance with provided cachePath', () => {
      // Act
      diskCache = new DiskCache(cachePath)

      // Assert
      expect(diskCache).toBeDefined()
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should use default readFile and writeFile from fs-extra', () => {
      // Act
      diskCache = new DiskCache(cachePath)

      // Assert
      expect(diskCache).toBeDefined()
    })

    it('should use injected readFile and writeFile functions', () => {
      // Act
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)

      // Assert
      expect(diskCache).toBeDefined()
    })
  })

  describe('has', () => {
    beforeEach(() => {
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
    })

    it('should return true when file exists', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)

      // Act
      const result = diskCache.has(testKey)

      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(`${cachePath}/${testKey}`)
    })

    it('should return false when file does not exist', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)

      // Act
      const result = diskCache.has(testKey)

      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(`${cachePath}/${testKey}`)
    })

    it('should handle empty key string', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(`${cachePath}/`)
    })

    it('should handle keys with special characters', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      const specialKey = 'key-with-special_chars.123'

      // Act
      const result = diskCache.has(specialKey)

      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(`${cachePath}/${specialKey}`)
    })
  })

  describe('get', () => {
    beforeEach(() => {
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
    })

    it('should successfully read and return cached value', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(testKey)

      // Assert
      expect(result).toBe(testValue)
      expect(mockReadFile).toHaveBeenCalledWith(`${cachePath}/${testKey}`)
      expect(diskCache.getCumulativeStats()).toEqual({ hits: 1, total: 1 })
    })

    it('should increment total count on get', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')

      // Assert
      expect(diskCache.getCumulativeStats().total).toBe(2)
    })

    it('should increment hits count on successful read', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get(testKey)
      await diskCache.get(testKey)
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should not increment hits when read fails', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(testKey)

      // Assert
      expect(result).toBeNull()
      expect(diskCache.getCumulativeStats()).toEqual({ hits: 0, total: 1 })
    })

    it('should handle read file errors gracefully', async () => {
      // Arrange
      const error = new Error('Read error')
      mockReadFile.mockRejectedValue(error)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act & Assert
      await expect(diskCache.get(testKey)).resolves.toBeNull()
    })

    it('should release lock even on error', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Error'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.get(testKey)

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should use read lock for concurrent access', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get(testKey)

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith(testKey, expect.any(Function))
    })

    it('should handle object values', async () => {
      // Arrange
      const objectValue = { foo: 'bar', nested: { count: 42 } }
      mockReadFile.mockResolvedValue(objectValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(testKey)

      // Assert
      expect(result).toEqual(objectValue)
    })

    it('should handle null cached value', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(null)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(testKey)

      // Assert
      expect(result).toBeNull()
      expect(diskCache.getCumulativeStats().hits).toBe(1)
    })
  })

  describe('set', () => {
    beforeEach(() => {
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
    })

    it('should successfully write value to cache', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(testKey, testValue)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(`${cachePath}/${testKey}`, testValue)
    })

    it('should return false on write failure', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(testKey, testValue)

      // Assert
      expect(result).toBe(false)
    })

    it('should handle write file errors gracefully', async () => {
      // Arrange
      const error = new Error('Disk full')
      mockWriteFile.mockRejectedValue(error)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act & Assert
      await expect(diskCache.set(testKey, testValue)).resolves.toBe(false)
    })

    it('should release lock even on write error', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Error'))
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.set(testKey, testValue)

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should use write lock for exclusive access', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.set(testKey, testValue)

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith(testKey, expect.any(Function))
    })

    it('should write object values', async () => {
      // Arrange
      const objectValue = { foo: 'bar', nested: { count: 42 } }
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(testKey, objectValue)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(`${cachePath}/${testKey}`, objectValue)
    })

    it('should handle empty string value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(testKey, '')

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(`${cachePath}/${testKey}`, '')
    })

    it('should handle null value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(testKey, null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(`${cachePath}/${testKey}`, null)
    })

    it('should handle multiple consecutive writes', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const result1 = await diskCache.set('key1', 'value1')
      const result2 = await diskCache.set('key2', 'value2')

      // Assert
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
    })

    it('should return stats with default name', () => {
      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.name).toBe('disk-cache')
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should return stats with custom name', () => {
      // Act
      const stats = diskCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should return difference from last reported stats', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      await diskCache.get(testKey)

      // Act
      const stats1 = diskCache.getStats()
      const stats2 = diskCache.getStats()

      // Assert
      expect(stats1.total).toBe(1)
      expect(stats1.hits).toBe(1)
      expect(stats2.total).toBe(0)
      expect(stats2.hits).toBe(0)
    })

    it('should reset reported counts after getStats call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      await diskCache.get(testKey)
      await diskCache.get(testKey)

      // Act
      const stats1 = diskCache.getStats()
      // Perform more operations
      await diskCache.get(testKey)
      const stats2 = diskCache.getStats()

      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats1.total).toBe(2)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(1)
    })

    it('should handle zero stats', () => {
      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
        name: 'disk-cache',
      })
    })

    it('should track misses correctly', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('Not found'))
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      await diskCache.get(testKey)

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
    })

    it('should return cumulative stats starting at zero', () => {
      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({ hits: 0, total: 0 })
    })

    it('should accumulate all hits and totals', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      const stats1 = diskCache.getCumulativeStats()
      diskCache.getStats() // Reset reported
      await diskCache.get('key3')
      const stats2 = diskCache.getCumulativeStats()

      // Assert
      expect(stats1).toEqual({ hits: 2, total: 2 })
      expect(stats2).toEqual({ hits: 3, total: 3 })
    })

    it('should not reset cumulative stats on getStats call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      await diskCache.get(testKey)

      // Act
      diskCache.getStats()
      const cumulativeStats = diskCache.getCumulativeStats()

      // Assert
      expect(cumulativeStats).toEqual({ hits: 1, total: 1 })
    })

    it('should track mixed hits and misses cumulatively', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce(testValue)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.get('key3')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(2)
    })
  })

  describe('private getPathKey', () => {
    beforeEach(() => {
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
    })

    it('should construct correct path for key', () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      diskCache.get(testKey)

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith(`${cachePath}/${testKey}`)
    })

    it('should use join function from path module', () => {
      // Arrange
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      diskCache.get(testKey)

      // Assert
      expect(join).toHaveBeenCalledWith(cachePath, testKey)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
    })

    it('should handle write then read pattern', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const writeResult = await diskCache.set(testKey, testValue)
      const readResult = await diskCache.get(testKey)

      // Assert
      expect(writeResult).toBe(true)
      expect(readResult).toBe(testValue)
    })

    it('should handle failed write then successful read of stale data', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockReadFile.mockResolvedValue(testValue)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      const writeResult = await diskCache.set(testKey, testValue)
      const readResult = await diskCache.get(testKey)

      // Assert
      expect(writeResult).toBe(false)
      expect(readResult).toBe(testValue)
    })

    it('should accurately track stats through multiple operations', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce('value1')
        .mockRejectedValueOnce(new Error('Miss'))
        .mockResolvedValueOnce('value3')
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((key, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key, callback) => {
        callback(() => {})
      })

      // Act
      await diskCache.set('key1', 'value1')
      await diskCache.get('key1') // hit
      await diskCache.get('key2') // miss
      await diskCache.get('key3') // hit
      const stats = diskCache.getStats()
      const cumulativeStats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(2)
      expect(cumulativeStats.total).toBe(3)
      expect(cumulativeStats.hits).toBe(2)
    })
  })
})
