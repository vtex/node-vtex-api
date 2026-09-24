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
  let mockPathExistsSync: jest.Mock
  let mockLockInstance: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Setup file system mocks
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockPathExistsSync = jest.fn()
    ;(fsExtra.pathExistsSync as jest.Mock) = mockPathExistsSync
    ;(fsExtra.readJSON as jest.Mock) = mockReadFile
    ;(fsExtra.outputJSON as jest.Mock) = mockWriteFile

    // Setup lock mock
    mockLockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    }
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLockInstance)

    // Create instance with mocked dependencies
    diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with provided cachePath and file operations', () => {
      // Act
      const cache = new DiskCache<string>('/test/cache')

      // Assert
      expect(cache).toBeDefined()
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should use default readJSON and outputJSON when not provided', () => {
      // Act
      const cache = new DiskCache<string>('/test/cache')

      // Assert
      expect(cache).toBeDefined()
    })

    it('should initialize lock instance', () => {
      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when file exists', () => {
      // Arrange
      const key = 'test-key'
      mockPathExistsSync.mockReturnValue(true)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/cache/path', key))
    })

    it('should return false when file does not exist', () => {
      // Arrange
      const key = 'missing-key'
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/cache/path', key))
    })

    it('should handle empty string keys', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/cache/path', ''))
    })

    it('should handle keys with special characters', () => {
      // Arrange
      const key = 'key-with/special\\chars'
      mockPathExistsSync.mockReturnValue(true)

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/cache/path', key))
    })
  })

  describe('get', () => {
    it('should resolve with data when file is found', async () => {
      // Arrange
      const key = 'test-key'
      const expectedData = 'test-value'
      mockReadFile.mockResolvedValue(expectedData)
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBe(expectedData)
      expect(mockReadFile).toHaveBeenCalledWith(join('/cache/path', key))
      expect(mockLockInstance.readLock).toHaveBeenCalled()
    })

    it('should resolve with undefined when file read fails', async () => {
      // Arrange
      const key = 'missing-key'
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBeNull()
    })

    it('should increment total counter', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get(key)
      const stats1 = diskCache.getCumulativeStats()
      await diskCache.get(key)
      const stats2 = diskCache.getCumulativeStats()

      // Assert
      expect(stats1.total).toBe(1)
      expect(stats2.total).toBe(2)
    })

    it('should increment hits counter on successful read', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get(key)
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
    })

    it('should not increment hits counter on failed read', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockRejectedValue(new Error('Error'))
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get(key)
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should use read lock with correct key', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockLockInstance.readLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should call release after reading data', async () => {
      // Arrange
      const key = 'test-key'
      const releaseFunc = jest.fn()
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(releaseFunc)
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(releaseFunc).toHaveBeenCalled()
    })

    it('should call release even when read fails', async () => {
      // Arrange
      const key = 'test-key'
      const releaseFunc = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Error'))
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(releaseFunc)
        }
      )

      // Act
      await diskCache.get(key)

      // Assert
      expect(releaseFunc).toHaveBeenCalled()
    })

    it('should handle empty string key', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get('')

      // Assert
      expect(result).toBe('data')
    })
  })

  describe('set', () => {
    it('should write file and return true on success', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', key), value)
    })

    it('should return false when write fails', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
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
      const key = 'test-key'
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.set(key, 'value')

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should call release after writing data', async () => {
      // Arrange
      const releaseFunc = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(releaseFunc)
        }
      )

      // Act
      await diskCache.set('key', 'value')

      // Assert
      expect(releaseFunc).toHaveBeenCalled()
    })

    it('should call release even when write fails', async () => {
      // Arrange
      const releaseFunc = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Error'))
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(releaseFunc)
        }
      )

      // Act
      await diskCache.set('key', 'value')

      // Assert
      expect(releaseFunc).toHaveBeenCalled()
    })

    it('should handle empty string key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set('', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle null value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set('key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), null)
    })

    it('should handle complex object values', async () => {
      // Arrange
      const complexValue = { nested: { data: [1, 2, 3] } }
      mockWriteFile.mockResolvedValue(undefined)
      const diskCacheComplex = new DiskCache<typeof complexValue>('/cache/path', mockReadFile, mockWriteFile)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCacheComplex.set('key', complexValue)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(expect.any(String), complexValue)
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
        name: 'disk-cache',
      })
    })

    it('should return stats with custom name', () => {
      // Act
      const stats = diskCache.getStats('my-cache')

      // Assert
      expect(stats.name).toBe('my-cache')
    })

    it('should calculate delta from previous getStats call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      await diskCache.get('key1')
      const stats1 = diskCache.getStats()

      // Act
      await diskCache.get('key2')
      const stats2 = diskCache.getStats()

      // Assert
      expect(stats1.total).toBe(1)
      expect(stats1.hits).toBe(1)
      expect(stats2.total).toBe(1)
      expect(stats2.hits).toBe(1)
    })

    it('should reset reported counters after getStats', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      await diskCache.get('key1')
      diskCache.getStats()

      // Act
      await diskCache.get('key2')
      const stats = diskCache.getStats()

      // Assert
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(1)
    })

    it('should return zero stats initially', () => {
      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should handle multiple consecutive calls', () => {
      // Act
      diskCache.getStats()
      const stats = diskCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative hits and total', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      await diskCache.get('key1')

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should accumulate stats across multiple operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        )
      )
      await diskCache.get('key1')
      diskCache.getStats() // Reset reported
      await diskCache.get('key2')
      await diskCache.get('key3')

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(3)
    })

    it('should not reset counters after getCumulativeStats', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      await diskCache.get('key1')

      // Act
      const stats1 = diskCache.getCumulativeStats()
      const stats2 = diskCache.getCumulativeStats()

      // Assert
      expect(stats1).toEqual(stats2)
    })

    it('should return zero stats initially', () => {
      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should track misses correctly', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('Not found'))
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get('key1')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(0)
    })
  })

  describe('integration scenarios', () => {
    it('should handle get and set sequence', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(value)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const setResult = await diskCache.set(key, value)
      const getResult = await diskCache.get(key)

      // Assert
      expect(setResult).toBe(true)
      expect(getResult).toBe(value)
    })

    it('should handle has, get, set operations', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockPathExistsSync.mockReturnValue(false)
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(value)
      mockLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      mockLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const hasBefore = diskCache.has(key)
      await diskCache.set(key, value)
      mockPathExistsSync.mockReturnValue(true)
      const hasAfter = diskCache.has(key)
      const getResult = await diskCache.get(key)
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(hasBefore).toBe(false)
      expect(hasAfter).toBe(true)
      expect(getResult).toBe(value)
      expect(stats.total).toBe(1)
      expect(stats.hits).toBe(1)
    })
  })
})
