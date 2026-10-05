import { DiskCache } from './DiskCache'
import * as fsExtra from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('rwlock')

describe('DiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockPathExistsSync: jest.Mock
  let mockLock: jest.Mocked<ReadWriteLock>
  let diskCache: DiskCache<string>
  const cachePath = '/cache'

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockPathExistsSync = jest.fn()
    
    mockLock = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as unknown as jest.Mocked<ReadWriteLock>
    
    ;(fsExtra.readJSON as jest.Mock) = mockReadFile
    ;(fsExtra.outputJSON as jest.Mock) = mockWriteFile
    ;(fsExtra.pathExistsSync as jest.Mock) = mockPathExistsSync
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)
    
    diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with cache path and default file operations', () => {
      // Arrange & Act
      const cache = new DiskCache(cachePath)
      
      // Assert
      expect(cache).toBeInstanceOf(DiskCache)
    })

    it('should initialize with custom read and write functions', () => {
      // Arrange
      const customRead = jest.fn()
      const customWrite = jest.fn()
      
      // Act
      const cache = new DiskCache(cachePath, customRead, customWrite)
      
      // Assert
      expect(cache).toBeInstanceOf(DiskCache)
    })

    it('should initialize ReadWriteLock', () => {
      // Act
      const cache = new DiskCache(cachePath)
      
      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize stats to zero', () => {
      // Act
      const stats = diskCache.getCumulativeStats()
      
      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('has', () => {
    it('should return true when file exists', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)
      const key = 'test-key'
      
      // Act
      const result = diskCache.has(key)
      
      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join(cachePath, key))
    })

    it('should return false when file does not exist', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)
      const key = 'test-key'
      
      // Act
      const result = diskCache.has(key)
      
      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join(cachePath, key))
    })

    it('should handle empty key string', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)
      
      // Act
      const result = diskCache.has('')
      
      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith(cachePath)
    })

    it('should handle keys with path separators', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)
      const key = 'sub/path/to/key'
      
      // Act
      const result = diskCache.has(key)
      
      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join(cachePath, key))
    })
  })

  describe('get', () => {
    it('should retrieve and return cached value on success', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'cached-value'
      const pathKey = join(cachePath, key)
      
      mockReadFile.mockResolvedValue(value)
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.get(key)
      
      // Assert
      expect(result).toBe(value)
      expect(mockReadFile).toHaveBeenCalledWith(pathKey)
      expect(mockLock.readLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should increment total counter on get attempt', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get(key)
      
      // Assert
      const stats = diskCache.getCumulativeStats()
      expect(stats.total).toBe(1)
    })

    it('should increment hits counter on successful read', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get(key)
      
      // Assert
      const stats = diskCache.getCumulativeStats()
      expect(stats.hits).toBe(1)
    })

    it('should not increment hits on read failure', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get(key)
      
      // Assert
      const stats = diskCache.getCumulativeStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })

    it('should return undefined when file read throws error', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockRejectedValue(new Error('Read failed'))
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.get(key)
      
      // Assert
      expect(result).toBeNull()
    })

    it('should handle multiple consecutive gets', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.get('key3')
      
      // Assert
      const stats = diskCache.getCumulativeStats()
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(3)
    })

    it('should release read lock on success', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(releaseFn)
      })
      
      // Act
      await diskCache.get('key')
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release read lock on error', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Read failed'))
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(releaseFn)
      })
      
      // Act
      await diskCache.get('key')
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should handle empty key', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('')
      
      // Assert
      expect(mockReadFile).toHaveBeenCalledWith(cachePath)
    })

    it('should handle complex object values', async () => {
      // Arrange
      const key = 'test-key'
      const complexValue = { data: [1, 2, 3], nested: { key: 'value' } }
      mockReadFile.mockResolvedValue(complexValue)
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.get(key)
      
      // Assert
      expect(result).toEqual(complexValue)
    })
  })

  describe('set', () => {
    it('should write value to file on success', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const pathKey = join(cachePath, key)
      
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.set(key, value)
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(pathKey, value)
      expect(mockLock.writeLock).toHaveBeenCalledWith(key, expect.any(Function))
    })

    it('should return false when write fails', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.set(key, value)
      
      // Assert
      expect(result).toBe(false)
    })

    it('should release write lock on success', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(releaseFn)
      })
      
      // Act
      await diskCache.set('key', 'value')
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release write lock on error', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(releaseFn)
      })
      
      // Act
      await diskCache.set('key', 'value')
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should handle empty key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.set('', 'value')
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(cachePath, 'value')
    })

    it('should handle complex object values', async () => {
      // Arrange
      const key = 'test-key'
      const complexValue = { data: [1, 2, 3], nested: { key: 'value' } }
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.set(key, complexValue)
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join(cachePath, key), complexValue)
    })

    it('should handle null values', async () => {
      // Arrange
      const key = 'test-key'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.set(key, null as unknown as string)
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join(cachePath, key), null)
    })

    it('should handle undefined values', async () => {
      // Arrange
      const key = 'test-key'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result = await diskCache.set(key, undefined as unknown as string)
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join(cachePath, key), undefined)
    })

    it('should handle multiple consecutive sets', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const result1 = await diskCache.set('key1', 'value1')
      const result2 = await diskCache.set('key2', 'value2')
      const result3 = await diskCache.set('key3', 'value3')
      
      // Assert
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledTimes(3)
    })
  })

  describe('getStats', () => {
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

    it('should track delta hits since last report', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      const stats1 = diskCache.getStats()
      await diskCache.get('key3')
      const stats2 = diskCache.getStats()
      
      // Assert
      expect(stats1.hits).toBe(2)
      expect(stats2.hits).toBe(1)
    })

    it('should track delta total since last report', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      const stats1 = diskCache.getStats()
      await diskCache.get('key3')
      const stats2 = diskCache.getStats()
      
      // Assert
      expect(stats1.total).toBe(2)
      expect(stats2.total).toBe(1)
    })

    it('should reset reported stats after getStats call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      diskCache.getStats()
      const stats = diskCache.getStats()
      
      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should return zero stats when no operations performed', () => {
      // Act
      const stats = diskCache.getStats()
      
      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      diskCache.getStats()
      await diskCache.get('key3')
      const stats = diskCache.getCumulativeStats()
      
      // Assert
      expect(stats.hits).toBe(3)
      expect(stats.total).toBe(3)
    })

    it('should not reset cumulative stats', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      const stats1 = diskCache.getCumulativeStats()
      diskCache.getStats()
      const stats2 = diskCache.getCumulativeStats()
      
      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats2.hits).toBe(1)
    })

    it('should return zero stats on new instance', () => {
      // Act
      const stats = diskCache.getCumulativeStats()
      
      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })

    it('should track cumulative stats across mixed operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      await diskCache.set('key2', 'value')
      await diskCache.get('key3')
      const stats = diskCache.getCumulativeStats()
      
      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    it('should handle concurrent read and write operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('read-value')
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      const [readResult, writeResult] = await Promise.all([
        diskCache.get('key1'),
        diskCache.set('key2', 'value'),
      ])
      
      // Assert
      expect(readResult).toBe('read-value')
      expect(writeResult).toBe(true)
    })

    it('should track stats accurately across multiple operations', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce('value1')
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce('value2')
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((lockKey, callback) => {
        callback(() => {})
      })
      
      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.set('key3', 'value')
      await diskCache.get('key4')
      const stats = diskCache.getCumulativeStats()
      const deltaStats = diskCache.getStats()
      
      // Assert
      expect(stats.total).toBe(4)
      expect(stats.hits).toBe(2)
      expect(deltaStats.total).toBe(4)
      expect(deltaStats.hits).toBe(2)
    })
  })
})
