import { DiskCache } from './DiskCache'
import { WindowedCounters } from './WindowedCounters'
import * as fsExtra from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('path')
jest.mock('rwlock')
jest.mock('./WindowedCounters')

describe('DiskCache', () => {
  let diskCache: DiskCache<any>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockWindowedCounters: jest.Mocked<WindowedCounters>
  let mockLock: jest.Mocked<ReadWriteLock>
  const cachePath = '/cache'

  beforeEach(() => {
    jest.clearAllMocks()

    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    mockWindowedCounters = {
      windowed: jest.fn(),
      cumulative: jest.fn(),
      countRead: jest.fn(),
      countHit: jest.fn(),
    } as any

    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any

    ;(ReadWriteLock as jest.MockedClass<typeof ReadWriteLock>).mockImplementation(
      () => mockLock
    )
    ;(WindowedCounters as jest.MockedClass<typeof WindowedCounters>).mockImplementation(
      () => mockWindowedCounters
    )

    diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with provided cachePath and file handlers', () => {
      // Arrange
      const path = '/my/cache'
      const customReadFile = jest.fn()
      const customWriteFile = jest.fn()

      // Act
      const cache = new DiskCache(path, customReadFile, customWriteFile)

      // Assert
      expect(cache).toBeDefined()
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize with default readJSON and outputJSON when not provided', () => {
      // Act
      const cache = new DiskCache(cachePath)

      // Assert
      expect(cache).toBeDefined()
    })

    it('should initialize WindowedCounters', () => {
      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when file exists at key path', () => {
      // Arrange
      const key = 'test-key'
      const fullPath = join(cachePath, key)
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      ;(join as jest.Mock).mockReturnValue(fullPath)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(fullPath)
    })

    it('should return false when file does not exist at key path', () => {
      // Arrange
      const key = 'nonexistent-key'
      const fullPath = join(cachePath, key)
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)
      ;(join as jest.Mock).mockReturnValue(fullPath)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(fullPath)
    })

    it('should handle empty key string', () => {
      // Arrange
      const key = ''
      const fullPath = join(cachePath, key)
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)
      ;(join as jest.Mock).mockReturnValue(fullPath)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getStats', () => {
    it('should return disk stats with default name', () => {
      // Arrange
      mockWindowedCounters.windowed.mockReturnValue({ hits: 5, total: 10 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({ hits: 5, name: 'disk-cache', total: 10 })
      expect(mockWindowedCounters.windowed).toHaveBeenCalled()
    })

    it('should return disk stats with custom name', () => {
      // Arrange
      const customName = 'my-cache'
      mockWindowedCounters.windowed.mockReturnValue({ hits: 3, total: 8 })

      // Act
      const stats = diskCache.getStats(customName)

      // Assert
      expect(stats).toEqual({ hits: 3, name: customName, total: 8 })
    })

    it('should handle zero hits and total', () => {
      // Arrange
      mockWindowedCounters.windowed.mockReturnValue({ hits: 0, total: 0 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({ hits: 0, name: 'disk-cache', total: 0 })
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockWindowedCounters.cumulative.mockReturnValue({ hits: 100, total: 200 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({ hits: 100, total: 200 })
      expect(mockWindowedCounters.cumulative).toHaveBeenCalled()
    })

    it('should handle large cumulative values', () => {
      // Arrange
      mockWindowedCounters.cumulative.mockReturnValue({
        hits: 1000000,
        total: 2000000,
      })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({ hits: 1000000, total: 2000000 })
    })
  })

  describe('get', () => {
    it('should retrieve value from cache on success', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test-data' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockReadFile.mockResolvedValue(value)
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toEqual(value)
      expect(mockReadFile).toHaveBeenCalledWith(fullPath)
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
      expect(mockWindowedCounters.countHit).toHaveBeenCalled()
    })

    it('should return undefined on file read error', async () => {
      // Arrange
      const key = 'missing-key'
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
      expect(mockWindowedCounters.countHit).not.toHaveBeenCalled()
    })

    it('should use read lock with correct key', async () => {
      // Arrange
      const key = 'locked-key'
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockReadFile.mockResolvedValue({})
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          expect(lockKey).toBe(key)
          callback(() => {})
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should release lock even on error', async () => {
      // Arrange
      const key = 'error-key'
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockReadFile.mockRejectedValue(new Error('Read error'))
      const releaseMock = jest.fn()
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(releaseMock)
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should handle empty key', async () => {
      // Arrange
      const key = ''
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toEqual({ data: 'test' })
    })

    it('should handle null file data', async () => {
      // Arrange
      const key = 'null-key'
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockReadFile.mockResolvedValue(null)
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBeNull()
      expect(mockWindowedCounters.countHit).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should write value to cache successfully', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test-value' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(fullPath, value)
    })

    it('should return false on write error', async () => {
      // Arrange
      const key = 'error-key'
      const value = { data: 'test' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should use write lock with correct key', async () => {
      // Arrange
      const key = 'locked-write-key'
      const value = { data: 'test' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          expect(lockKey).toBe(key)
          callback(() => {})
        }
      )

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should release lock even on error', async () => {
      // Arrange
      const key = 'error-lock-key'
      const value = { data: 'test' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      const releaseMock = jest.fn()
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(releaseMock)
        }
      )

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should handle null value', async () => {
      // Arrange
      const key = 'null-value-key'
      const value = null
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(fullPath, null)
    })

    it('should handle empty key', async () => {
      // Arrange
      const key = ''
      const value = { data: 'test' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle write promise resolution', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockResolvedValue(true)
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getPathKey', () => {
    it('should construct correct file path', () => {
      // Arrange
      const key = 'subdir/file.json'
      const expectedPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(expectedPath)

      // Act
      diskCache.has(key)

      // Assert
      expect(join).toHaveBeenCalledWith(cachePath, key)
    })

    it('should handle complex keys with special characters', () => {
      // Arrange
      const key = 'key-with-dash_and_underscore.ext'
      const expectedPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(expectedPath)

      // Act
      diskCache.has(key)

      // Assert
      expect(join).toHaveBeenCalledWith(cachePath, key)
    })
  })

  describe('integration scenarios', () => {
    it('should handle sequential get operations', async () => {
      // Arrange
      const key1 = 'key1'
      const key2 = 'key2'
      const value1 = { id: 1 }
      const value2 = { id: 2 }
      ;(join as jest.Mock)
        .mockReturnValueOnce(join(cachePath, key1))
        .mockReturnValueOnce(join(cachePath, key2))
      mockReadFile
        .mockResolvedValueOnce(value1)
        .mockResolvedValueOnce(value2)
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const result1 = await diskCache.get(key1)
      const result2 = await diskCache.get(key2)

      // Assert
      expect(result1).toEqual(value1)
      expect(result2).toEqual(value2)
      expect(mockWindowedCounters.countRead).toHaveBeenCalledTimes(2)
      expect(mockWindowedCounters.countHit).toHaveBeenCalledTimes(2)
    })

    it('should handle set followed by get', async () => {
      // Arrange
      const key = 'test-key'
      const value = { data: 'test' }
      const fullPath = join(cachePath, key)
      ;(join as jest.Mock).mockReturnValue(fullPath)
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(value)
      mockLock.writeLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )
      mockLock.readLock.mockImplementation(
        (lockKey: string, callback: Function) => {
          callback(() => {})
        }
      )

      // Act
      const setResult = await diskCache.set(key, value)
      const getResult = await diskCache.get(key)

      // Assert
      expect(setResult).toBe(true)
      expect(getResult).toEqual(value)
    })
  })
})
