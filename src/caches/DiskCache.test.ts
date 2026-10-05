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
  let mockPathExistsSync: jest.Mock
  let mockReadWriteLock: jest.Mock
  let mockLock: any

  beforeEach(() => {
    // Arrange: Reset mocks and setup
    jest.clearAllMocks()
    
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockPathExistsSync = jest.fn()
    mockReadWriteLock = jest.fn()
    mockLock = {
      readLock: jest.fn((key: string, callback: Function) => {
        callback(() => {})
      }),
      writeLock: jest.fn((key: string, callback: Function) => {
        callback(() => {})
      }),
    }

    ;(fsExtra.readJSON as jest.Mock) = mockReadFile
    ;(fsExtra.outputJSON as jest.Mock) = mockWriteFile
    ;(fsExtra.pathExistsSync as jest.Mock) = mockPathExistsSync
    ;(ReadWriteLock as jest.Mock) = mockReadWriteLock.mockImplementation(() => mockLock)
  })

  describe('constructor', () => {
    it('should initialize with default read and write functions', () => {
      // Act
      diskCache = new DiskCache<string>('/test/cache')

      // Assert
      expect(diskCache).toBeDefined()
      expect(mockReadWriteLock).toHaveBeenCalledTimes(1)
    })

    it('should initialize with custom read and write functions', () => {
      // Arrange
      const customRead = jest.fn()
      const customWrite = jest.fn()

      // Act
      diskCache = new DiskCache<string>('/test/cache', customRead, customWrite)

      // Assert
      expect(diskCache).toBeDefined()
      expect(mockReadWriteLock).toHaveBeenCalledTimes(1)
    })
  })

  describe('has', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should return true when file exists', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)

      // Act
      const result = diskCache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/test/cache', 'test-key'))
    })

    it('should return false when file does not exist', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has('test-key')

      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/test/cache', 'test-key'))
    })

    it('should handle empty key strings', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/test/cache', ''))
    })

    it('should handle keys with special characters', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)
      const specialKey = 'key/with\\special@chars#123'

      // Act
      const result = diskCache.has(specialKey)

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/test/cache', specialKey))
    })
  })

  describe('get', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should retrieve value from cache and increment hits', async () => {
      // Arrange
      const testData = 'cached-value'
      mockReadFile.mockResolvedValue(testData)
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get('test-key')

      // Assert
      expect(result).toBe(testData)
      expect(mockReadFile).toHaveBeenCalledWith(join('/test/cache', 'test-key'))
      expect(diskCache.getCumulativeStats().hits).toBe(1)
      expect(diskCache.getCumulativeStats().total).toBe(1)
    })

    it('should increment total even when read fails', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get('test-key')

      // Assert
      expect(result).toBeUndefined()
      expect(diskCache.getCumulativeStats().hits).toBe(0)
      expect(diskCache.getCumulativeStats().total).toBe(1)
    })

    it('should handle empty key', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get('')

      // Assert
      expect(result).toBe('value')
      expect(mockReadFile).toHaveBeenCalledWith(join('/test/cache', ''))
    })

    it('should use read lock for concurrent access', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(mockLock.readLock).toHaveBeenCalledWith(
        'test-key',
        expect.any(Function)
      )
    })

    it('should release lock even on read failure', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Read error'))
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release lock on successful read', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockReadFile.mockResolvedValue('data')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should handle multiple consecutive gets', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value1')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })
  })

  describe('set', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should write value to cache', async () => {
      // Arrange
      const testValue = 'test-data'
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set('test-key', testValue)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/cache', 'test-key'),
        testValue
      )
    })

    it('should return false on write failure', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set('test-key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should use write lock for concurrent access', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await diskCache.set('test-key', 'value')

      // Assert
      expect(mockLock.writeLock).toHaveBeenCalledWith(
        'test-key',
        expect.any(Function)
      )
    })

    it('should release lock even on write failure', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.set('test-key', 'value')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release lock on successful write', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(releaseFn)
      })

      // Act
      await diskCache.set('test-key', 'value')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should handle empty key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set('', 'value')

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/test/cache', ''), 'value')
    })

    it('should handle null value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set('test-key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/cache', 'test-key'),
        null
      )
    })

    it('should handle complex object values', async () => {
      // Arrange
      const complexValue = { nested: { data: [1, 2, 3] } }
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set('test-key', complexValue as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(
        join('/test/cache', 'test-key'),
        complexValue
      )
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should return stats with default name', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.name).toBe('disk-cache')
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should return stats with custom name', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')

      // Act
      const stats = diskCache.getStats('custom-cache')

      // Assert
      expect(stats.name).toBe('custom-cache')
    })

    it('should reset reported stats after getStats call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')

      // Act
      const stats1 = diskCache.getStats()
      const stats2 = diskCache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(0)
      expect(stats2.total).toBe(0)
    })

    it('should calculate delta between calls', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')
      diskCache.getStats()
      await diskCache.get('key2')
      await diskCache.get('key3')

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should handle failed reads in stats', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('Read error'))
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(1)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should return cumulative stats', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')
      await diskCache.get('key2')

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should not reset stats after getCumulativeStats call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')

      // Act
      const stats1 = diskCache.getCumulativeStats()
      const stats2 = diskCache.getCumulativeStats()

      // Assert
      expect(stats1.hits).toBe(stats2.hits)
      expect(stats1.total).toBe(stats2.total)
    })

    it('should accumulate stats across multiple operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.set('key3', 'value')

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(2)
      expect(stats.total).toBe(2)
    })

    it('should return initial stats when no operations performed', () => {
      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/test/cache', mockReadFile, mockWriteFile)
    })

    it('should handle mixed read/write operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('cached')
      mockWriteFile.mockResolvedValue(undefined)
      mockLock.readLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockLock.writeLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await diskCache.set('key1', 'value1')
      await diskCache.get('key1')
      await diskCache.set('key2', 'value2')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should track has checks without affecting stats', async () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)

      // Act
      diskCache.has('key1')
      diskCache.has('key2')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
    })
  })
})
