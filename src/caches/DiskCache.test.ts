import { DiskCache } from './DiskCache'
import { WindowedCounters } from './WindowedCounters'
import { pathExistsSync } from 'fs-extra'
import ReadWriteLock from 'rwlock'
import { join } from 'path'

jest.mock('fs-extra')
jest.mock('rwlock')
jest.mock('./WindowedCounters')

describe('DiskCache', () => {
  let diskCache: DiskCache<string>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockReadWriteLock: jest.Mock
  let mockWindowedCounters: jest.Mock
  let mockLockInstance: any
  let mockCountersInstance: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mocks
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockLockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    }
    mockReadWriteLock = jest.fn(() => mockLockInstance)
    ;(ReadWriteLock as jest.Mock).mockImplementation(mockReadWriteLock)

    mockCountersInstance = {
      windowed: jest.fn(),
      cumulative: jest.fn(),
      countRead: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
    }
    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockCountersInstance)

    // Create instance
    diskCache = new DiskCache<string>('/test/cache', mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with custom cache path', () => {
      // Act
      const cache = new DiskCache<string>('/custom/path', mockReadFile, mockWriteFile)

      // Assert
      expect(cache).toBeInstanceOf(DiskCache)
    })

    it('should initialize with default readFile and writeFile', () => {
      // Act
      const cache = new DiskCache<string>('/test/cache')

      // Assert
      expect(cache).toBeInstanceOf(DiskCache)
    })

    it('should create a ReadWriteLock instance', () => {
      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should create a WindowedCounters instance', () => {
      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when file exists', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)
      const key = 'test-key'

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(pathExistsSync).toHaveBeenCalledWith(join('/test/cache', key))
    })

    it('should return false when file does not exist', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(false)
      const key = 'nonexistent-key'

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(pathExistsSync).toHaveBeenCalledWith(join('/test/cache', key))
    })

    it('should handle empty string key', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(false)
      const key = ''

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(false)
      expect(pathExistsSync).toHaveBeenCalledWith(join('/test/cache', key))
    })

    it('should handle special characters in key', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)
      const key = 'key-with-special!@#$%'

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(pathExistsSync).toHaveBeenCalledWith(join('/test/cache', key))
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        hits: 5,
        total: 10,
      })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 5,
        name: 'disk-cache',
        total: 10,
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        hits: 3,
        total: 8,
      })
      const customName = 'my-cache'

      // Act
      const stats = diskCache.getStats(customName)

      // Assert
      expect(stats).toEqual({
        hits: 3,
        name: customName,
        total: 8,
      })
    })

    it('should call windowed() on counters', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        hits: 0,
        total: 0,
      })

      // Act
      diskCache.getStats()

      // Assert
      expect(mockCountersInstance.windowed).toHaveBeenCalled()
    })

    it('should handle zero stats', () => {
      // Arrange
      mockCountersInstance.windowed.mockReturnValue({
        hits: 0,
        total: 0,
      })

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
      mockCountersInstance.cumulative.mockReturnValue({
        hits: 100,
        misses: 20,
        total: 120,
      })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        hits: 100,
        misses: 20,
        total: 120,
      })
    })

    it('should call cumulative() on counters', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        hits: 0,
        misses: 0,
        total: 0,
      })

      // Act
      diskCache.getCumulativeStats()

      // Assert
      expect(mockCountersInstance.cumulative).toHaveBeenCalled()
    })

    it('should handle large stat values', () => {
      // Arrange
      mockCountersInstance.cumulative.mockReturnValue({
        hits: 999999,
        misses: 111111,
        total: 1111110,
      })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(999999)
      expect(stats.misses).toBe(111111)
      expect(stats.total).toBe(1111110)
    })
  })

  describe('get', () => {
    it('should return file data on successful read', async () => {
      // Arrange
      const key = 'test-key'
      const expectedData = 'test-value'
      mockReadFile.mockResolvedValue(expectedData)
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBe(expectedData)
      expect(mockReadFile).toHaveBeenCalledWith(join('/test/cache', key))
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
      expect(mockCountersInstance.countHit).toHaveBeenCalled()
    })

    it('should count miss on read error', async () => {
      // Arrange
      const key = 'missing-key'
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBeUndefined()
      expect(mockCountersInstance.countRead).toHaveBeenCalled()
      expect(mockCountersInstance.countMiss).toHaveBeenCalled()
    })

    it('should release lock after successful read', async () => {
      // Arrange
      const key = 'test-key'
      const releaseSpy = jest.fn()
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(releaseSpy)
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(releaseSpy).toHaveBeenCalled()
    })

    it('should release lock after read error', async () => {
      // Arrange
      const key = 'test-key'
      const releaseSpy = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Error'))
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(releaseSpy)
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(releaseSpy).toHaveBeenCalled()
    })

    it('should acquire read lock with correct key', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(mockLockInstance.readLock).toHaveBeenCalledWith(
        key,
        expect.any(Function)
      )
    })

    it('should handle empty string key', async () => {
      // Arrange
      const key = ''
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toBe('data')
    })

    it('should handle complex object data', async () => {
      // Arrange
      const key = 'object-key'
      const complexData = { nested: { value: 'test' }, array: [1, 2, 3] }
      mockReadFile.mockResolvedValue(complexData)
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.get(key)

      // Assert
      expect(result).toEqual(complexData)
    })

    it('should count read before acquiring lock', async () => {
      // Arrange
      const key = 'test-key'
      mockReadFile.mockResolvedValue('data')
      const callOrder: string[] = []
      mockCountersInstance.countRead.mockImplementation(() => {
        callOrder.push('countRead')
      })
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callOrder.push('readLock')
        callback(() => {})
      })

      // Act
      await diskCache.get(key)

      // Assert
      expect(callOrder[0]).toBe('countRead')
      expect(callOrder[1]).toBe('readLock')
    })
  })

  describe('set', () => {
    it('should write file data successfully', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/test/cache', key), value)
    })

    it('should return false on write error', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should release lock after successful write', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const releaseSpy = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(releaseSpy)
      })

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(releaseSpy).toHaveBeenCalled()
    })

    it('should release lock after write error', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      const releaseSpy = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Error'))
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(releaseSpy)
      })

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(releaseSpy).toHaveBeenCalled()
    })

    it('should acquire write lock with correct key', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      await diskCache.set(key, value)

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalledWith(
        key,
        expect.any(Function)
      )
    })

    it('should handle empty string key', async () => {
      // Arrange
      const key = ''
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    it('should handle complex object values', async () => {
      // Arrange
      const key = 'object-key'
      const value = { nested: { value: 'test' }, array: [1, 2, 3] }
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/test/cache', key), value)
    })

    it('should handle null values', async () => {
      // Arrange
      const key = 'null-key'
      const value: any = null
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/test/cache', key), value)
    })

    it('should handle writeFile returning false', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(false)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(false)
    })

    it('should handle writeFile returning true', async () => {
      // Arrange
      const key = 'test-key'
      const value = 'test-value'
      mockWriteFile.mockResolvedValue(true)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const result = await diskCache.set(key, value)

      // Assert
      expect(result).toBe(false) // negation of true
    })
  })

  describe('CacheLayer interface compliance', () => {
    it('should have has method', () => {
      expect(typeof diskCache.has).toBe('function')
    })

    it('should have get method', () => {
      expect(typeof diskCache.get).toBe('function')
    })

    it('should have set method', () => {
      expect(typeof diskCache.set).toBe('function')
    })

    it('should have getStats method', () => {
      expect(typeof diskCache.getStats).toBe('function')
    })

    it('should have getCumulativeStats method', () => {
      expect(typeof diskCache.getCumulativeStats).toBe('function')
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple get operations concurrently', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const results = await Promise.all([
        diskCache.get('key1'),
        diskCache.get('key2'),
        diskCache.get('key3'),
      ])

      // Assert
      expect(results).toHaveLength(3)
      expect(mockCountersInstance.countRead).toHaveBeenCalledTimes(3)
    })

    it('should handle multiple set operations concurrently', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const results = await Promise.all([
        diskCache.set('key1', 'value1'),
        diskCache.set('key2', 'value2'),
        diskCache.set('key3', 'value3'),
      ])

      // Assert
      expect(results).toEqual([true, true, true])
      expect(mockWriteFile).toHaveBeenCalledTimes(3)
    })

    it('should handle mixed get and set operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.readLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })
      mockLockInstance.writeLock.mockImplementation((lockKey: string, callback: Function) => {
        callback(() => {})
      })

      // Act
      const results = await Promise.all([
        diskCache.get('key1'),
        diskCache.set('key2', 'value2'),
        diskCache.get('key3'),
      ])

      // Assert
      expect(results).toHaveLength(3)
      expect(mockReadFile).toHaveBeenCalledTimes(2)
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
    })
  })

  describe('path construction', () => {
    it('should construct correct cache path for key', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)
      const key = 'test-key'

      // Act
      diskCache.has(key)

      // Assert
      expect(pathExistsSync).toHaveBeenCalledWith(join('/test/cache', key))
    })

    it('should handle keys with path separators', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)
      const key = 'subdir/test-key'

      // Act
      diskCache.has(key)

      // Assert
      expect(pathExistsSync).toHaveBeenCalledWith(join('/test/cache', key))
    })
  })
})
