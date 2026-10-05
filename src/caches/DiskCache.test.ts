import { DiskCache } from './DiskCache'
import { WindowedCounters } from './WindowedCounters'
import * as fsExtra from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('rwlock')
jest.mock('./WindowedCounters')

describe('DiskCache', () => {
  let diskCache: DiskCache<any>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockPathExistsSync: jest.Mock
  let mockReadLock: jest.Mock
  let mockWriteLock: jest.Mock
  let mockLockInstance: any
  let mockCounters: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock fs-extra functions
    mockPathExistsSync = jest.fn()
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    ;(fsExtra.pathExistsSync as jest.Mock) = mockPathExistsSync
    ;(fsExtra.readJSON as jest.Mock) = mockReadFile
    ;(fsExtra.outputJSON as jest.Mock) = mockWriteFile

    // Mock lock instance
    mockReadLock = jest.fn()
    mockWriteLock = jest.fn()
    mockLockInstance = {
      readLock: mockReadLock,
      writeLock: mockWriteLock,
    }
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLockInstance)

    // Mock counters
    mockCounters = {
      countRead: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
      windowed: jest.fn(),
      cumulative: jest.fn(),
    }
    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockCounters)
  })

  describe('constructor', () => {
    it('should initialize with cachePath and default read/write functions', () => {
      // Arrange & Act
      diskCache = new DiskCache('/cache/path')

      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
      expect(WindowedCounters).toHaveBeenCalled()
    })

    it('should initialize with custom read and write functions', () => {
      // Arrange
      const customRead = jest.fn()
      const customWrite = jest.fn()

      // Act
      diskCache = new DiskCache('/cache/path', customRead, customWrite)

      // Assert
      expect(diskCache).toBeDefined()
    })
  })

  describe('has', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should return true when file exists at cache path', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)

      // Act
      const result = diskCache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/cache/path', 'test-key'))
    })

    it('should return false when file does not exist at cache path', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has('test-key')

      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/cache/path', 'test-key'))
    })

    it('should handle empty string key', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalled()
    })

    it('should handle key with special characters', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)
      const specialKey = 'key/with/slashes/../dots'

      // Act
      const result = diskCache.has(specialKey)

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/cache/path', specialKey))
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should return windowed stats with default name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 5, total: 10 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({ hits: 5, name: 'disk-cache', total: 10 })
    })

    it('should return windowed stats with custom name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 3, total: 7 })

      // Act
      const stats = diskCache.getStats('custom-cache-name')

      // Assert
      expect(stats).toEqual({ hits: 3, name: 'custom-cache-name', total: 7 })
    })

    it('should handle zero hits and total', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 0, total: 0 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({ hits: 0, name: 'disk-cache', total: 0 })
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should return cumulative stats with hits, misses, and total', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({ hits: 20, misses: 5, total: 25 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({ hits: 20, misses: 5, total: 25 })
    })

    it('should handle zero values', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({ hits: 0, misses: 0, total: 0 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({ hits: 0, misses: 0, total: 0 })
    })

    it('should handle only misses', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({ hits: 0, misses: 15, total: 15 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({ hits: 0, misses: 15, total: 15 })
    })
  })

  describe('get', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should read and return value from cache on success', async () => {
      // Arrange
      const testValue = { data: 'test' }
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue(testValue)

      // Act
      const result = await diskCache.get('test-key')

      // Assert
      expect(result).toEqual(testValue)
      expect(mockReadFile).toHaveBeenCalledWith(join('/cache/path', 'test-key'))
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countHit).toHaveBeenCalled()
    })

    it('should return undefined and count miss on read failure', async () => {
      // Arrange
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockRejectedValue(new Error('File not found'))

      // Act
      const result = await diskCache.get('missing-key')

      // Assert
      expect(result).toBeUndefined()
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countMiss).toHaveBeenCalled()
    })

    it('should use read lock for concurrent access', async () => {
      // Arrange
      const testValue = 'value'
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue(testValue)

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(mockReadLock).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should handle empty string key', async () => {
      // Arrange
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('value')

      // Act
      const result = await diskCache.get('')

      // Assert
      expect(result).toEqual('value')
    })

    it('should handle numeric data', async () => {
      // Arrange
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue(42)

      // Act
      const result = await diskCache.get('number-key')

      // Assert
      expect(result).toBe(42)
    })

    it('should handle null data from file', async () => {
      // Arrange
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue(null)

      // Act
      const result = await diskCache.get('null-key')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle array data', async () => {
      // Arrange
      const arrayData = [1, 2, 3]
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue(arrayData)

      // Act
      const result = await diskCache.get('array-key')

      // Assert
      expect(result).toEqual(arrayData)
    })

    it('should release lock even on error', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(releaseFn)
      })
      mockReadFile.mockRejectedValue(new Error('Read error'))

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should write value to cache on success', async () => {
      // Arrange
      const testValue = { data: 'test' }
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('test-key', testValue)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'test-key'), testValue)
    })

    it('should return false on write failure', async () => {
      // Arrange
      const testValue = { data: 'test' }
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockRejectedValue(new Error('Write failed'))

      // Act
      const result = await diskCache.set('test-key', testValue)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true when write returns falsy value', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('test-key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when write promise resolves with true', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(true)

      // Act
      const result = await diskCache.set('test-key', 'value')

      // Assert
      expect(result).toBe(false)
    })

    it('should use write lock for concurrent access', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await diskCache.set('test-key', 'value')

      // Assert
      expect(mockWriteLock).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should handle empty string key', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle null value', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('null-key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'null-key'), null)
    })

    it('should handle undefined value', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('undefined-key', undefined as any)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle numeric values', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('number-key', 42)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle array values', async () => {
      // Arrange
      const arrayValue = [1, 2, 3]
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('array-key', arrayValue)

      // Assert
      expect(result).toBe(true)
    })

    it('should release lock even on error', async () => {
      // Arrange
      const releaseFn = jest.fn()
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(releaseFn)
      })
      mockWriteFile.mockRejectedValue(new Error('Write error'))

      // Act
      await diskCache.set('test-key', 'value')

      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      diskCache = new DiskCache('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should count statistics correctly after multiple operations', async () => {
      // Arrange
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('value')

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(2)
      expect(mockCounters.countHit).toHaveBeenCalledTimes(2)
    })

    it('should handle different cache paths', () => {
      // Arrange
      const cache1 = new DiskCache('/path1', mockReadFile, mockWriteFile)
      const cache2 = new DiskCache('/path2', mockReadFile, mockWriteFile)
      mockPathExistsSync.mockReturnValue(true)

      // Act
      cache1.has('key')
      cache2.has('key')

      // Assert
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/path1', 'key'))
      expect(mockPathExistsSync).toHaveBeenCalledWith(join('/path2', 'key'))
    })

    it('should handle rapid successive get calls', async () => {
      // Arrange
      mockReadLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockReadFile.mockResolvedValue('value')

      // Act
      const promises = [
        diskCache.get('key1'),
        diskCache.get('key2'),
        diskCache.get('key3'),
      ]
      await Promise.all(promises)

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(3)
    })

    it('should handle rapid successive set calls', async () => {
      // Arrange
      mockWriteLock.mockImplementation((key: string, callback: Function) => {
        callback(() => {})
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const promises = [
        diskCache.set('key1', 'value1'),
        diskCache.set('key2', 'value2'),
        diskCache.set('key3', 'value3'),
      ]
      const results = await Promise.all(promises)

      // Assert
      expect(results).toEqual([true, true, true])
    })
  })
})
