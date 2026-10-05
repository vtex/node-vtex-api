import { DiskCache } from './DiskCache'
import { WindowedCounters } from './WindowedCounters'
import { pathExistsSync } from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

// Mock dependencies
jest.mock('fs-extra')
jest.mock('./WindowedCounters')
jest.mock('rwlock')

describe('DiskCache', () => {
  let diskCache: DiskCache<string>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockCounters: jest.Mocked<WindowedCounters>
  let mockLock: jest.Mocked<ReadWriteLock>
  let mockReadLockFn: jest.Mock
  let mockWriteLockFn: jest.Mock
  const cachePath = '/test/cache'

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup mock counters
    mockCounters = {
      windowed: jest.fn().mockReturnValue({ hits: 5, total: 10 }),
      cumulative: jest.fn().mockReturnValue({ hits: 50, total: 100 }),
      countRead: jest.fn(),
      countHit: jest.fn(),
    } as unknown as jest.Mocked<WindowedCounters>

    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockCounters)

    // Setup mock lock functions
    mockReadLockFn = jest.fn((key: string, callback: (release: () => void) => void) => {
      const release = jest.fn()
      callback(release)
    })
    mockWriteLockFn = jest.fn((key: string, callback: (release: () => void) => void) => {
      const release = jest.fn()
      callback(release)
    })

    mockLock = {
      readLock: mockReadLockFn,
      writeLock: mockWriteLockFn,
    } as unknown as jest.Mocked<ReadWriteLock>

    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLock)

    // Setup file operation mocks
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    // Create instance with mocked dependencies
    diskCache = new DiskCache(cachePath, mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default file operations when not provided', () => {
      // Arrange & Act
      const cache = new DiskCache(cachePath)

      // Assert
      expect(cache).toBeDefined()
    })

    it('should initialize with custom file operations', () => {
      // Arrange
      const customRead = jest.fn()
      const customWrite = jest.fn()

      // Act
      const cache = new DiskCache(cachePath, customRead, customWrite)

      // Assert
      expect(cache).toBeDefined()
    })

    it('should create a ReadWriteLock instance', () => {
      // Arrange, Act & Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should initialize WindowedCounters', () => {
      // Arrange, Act & Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when file exists', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)

      // Act
      const result = diskCache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(pathExistsSync).toHaveBeenCalledWith(join(cachePath, 'test-key'))
    })

    it('should return false when file does not exist', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(false)

      // Act
      const result = diskCache.has('missing-key')

      // Assert
      expect(result).toBe(false)
      expect(pathExistsSync).toHaveBeenCalledWith(join(cachePath, 'missing-key'))
    })

    it('should handle empty string keys', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(false)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(false)
      expect(pathExistsSync).toHaveBeenCalledWith(join(cachePath, ''))
    })

    it('should handle keys with special characters', () => {
      // Arrange
      ;(pathExistsSync as jest.Mock).mockReturnValue(true)
      const specialKey = 'key/with/slashes'

      // Act
      const result = diskCache.has(specialKey)

      // Assert
      expect(result).toBe(true)
      expect(pathExistsSync).toHaveBeenCalledWith(join(cachePath, specialKey))
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 3, total: 12 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({ hits: 3, total: 12, name: 'disk-cache' })
      expect(mockCounters.windowed).toHaveBeenCalled()
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 7, total: 20 })

      // Act
      const stats = diskCache.getStats('custom-cache')

      // Assert
      expect(stats).toEqual({ hits: 7, total: 20, name: 'custom-cache' })
    })

    it('should handle zero hits', () => {
      // Arrange
      mockCounters.windowed.mockReturnValue({ hits: 0, total: 10 })

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(10)
    })

    it('should handle zero total', () => {
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
      mockCounters.cumulative.mockReturnValue({ hits: 50, total: 200 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({ hits: 50, total: 200 })
      expect(mockCounters.cumulative).toHaveBeenCalled()
    })

    it('should handle zero cumulative hits', () => {
      // Arrange
      mockCounters.cumulative.mockReturnValue({ hits: 0, total: 100 })

      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(100)
    })
  })

  describe('get', () => {
    it('should retrieve value successfully', async () => {
      // Arrange
      const testValue = 'test-data'
      mockReadFile.mockResolvedValue(testValue)
      mockReadLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        const release = jest.fn()
        callback(release)
      })

      // Act
      const result = await diskCache.get('test-key')

      // Assert
      expect(result).toBe(testValue)
      expect(mockCounters.countRead).toHaveBeenCalled()
      expect(mockCounters.countHit).toHaveBeenCalled()
      expect(mockReadFile).toHaveBeenCalledWith(join(cachePath, 'test-key'))
    })

    it('should count read on get operation', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')

      // Act
      await diskCache.get('key')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(1)
    })

    it('should count hit when file is read successfully', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')

      // Act
      await diskCache.get('key')

      // Assert
      expect(mockCounters.countHit).toHaveBeenCalledTimes(1)
    })

    it('should not count hit when file read fails', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockReadLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        const release = jest.fn()
        callback(release)
      })

      // Act
      await diskCache.get('missing-key')

      // Assert
      expect(mockCounters.countHit).not.toHaveBeenCalled()
    })

    it('should return undefined-like value when file read fails', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('Read error'))

      // Act
      const result = await diskCache.get('error-key')

      // Assert
      expect(result).toBeFalsy()
    })

    it('should handle empty key', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')

      // Act
      await diskCache.get('')

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith(join(cachePath, ''))
      expect(mockCounters.countRead).toHaveBeenCalled()
    })

    it('should use read lock for concurrent access', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(mockReadLockFn).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should release lock after reading successfully', async () => {
      // Arrange
      const releaseMock = jest.fn()
      mockReadLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        callback(releaseMock)
      })
      mockReadFile.mockResolvedValue('data')

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should release lock even when read fails', async () => {
      // Arrange
      const releaseMock = jest.fn()
      mockReadLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        callback(releaseMock)
      })
      mockReadFile.mockRejectedValue(new Error('Read error'))

      // Act
      await diskCache.get('error-key')

      // Assert
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should handle different data types', async () => {
      // Arrange
      const objectData = { foo: 'bar', num: 42 }
      mockReadFile.mockResolvedValue(objectData)
      const cache = new DiskCache<any>(cachePath, mockReadFile, mockWriteFile)

      // Act
      const result = await cache.get('object-key')

      // Assert
      expect(result).toEqual(objectData)
    })
  })

  describe('set', () => {
    it('should write value successfully', async () => {
      // Arrange
      const testValue = 'new-data'
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('test-key', testValue)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join(cachePath, 'test-key'), testValue)
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      mockWriteLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        const release = jest.fn()
        callback(release)
      })

      // Act
      const result = await diskCache.set('error-key', 'data')

      // Assert
      expect(result).toBe(false)
    })

    it('should use write lock for concurrent access', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await diskCache.set('test-key', 'data')

      // Assert
      expect(mockWriteLockFn).toHaveBeenCalledWith('test-key', expect.any(Function))
    })

    it('should release lock after writing successfully', async () => {
      // Arrange
      const releaseMock = jest.fn()
      mockWriteLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        callback(releaseMock)
      })
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await diskCache.set('test-key', 'data')

      // Assert
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should release lock even when write fails', async () => {
      // Arrange
      const releaseMock = jest.fn()
      mockWriteLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        callback(releaseMock)
      })
      mockWriteFile.mockRejectedValue(new Error('Write error'))

      // Act
      await diskCache.set('test-key', 'data')

      // Assert
      expect(releaseMock).toHaveBeenCalled()
    })

    it('should handle empty key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await diskCache.set('', 'data')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(join(cachePath, ''), 'data')
    })

    it('should handle different data types', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      const cache = new DiskCache<any>(cachePath, mockReadFile, mockWriteFile)
      const objectData = { foo: 'bar', nested: { value: 123 } }

      // Act
      const result = await cache.set('object-key', objectData)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join(cachePath, 'object-key'), objectData)
    })

    it('should handle null values', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('null-key', null as unknown as string)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join(cachePath, 'null-key'), null)
    })

    it('should return true when write succeeds with undefined result', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const result = await diskCache.set('key', 'value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when failure is truthy', async () => {
      // Arrange
      mockWriteFile.mockImplementation(() => {
        throw new Error('Write failed')
      })
      mockWriteLockFn.mockImplementation((key: string, callback: (release: () => void) => void) => {
        const release = jest.fn()
        callback(release)
      })

      // Act
      const result = await diskCache.set('key', 'value')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('integration scenarios', () => {
    it('should handle multiple concurrent get operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')

      // Act
      const [result1, result2, result3] = await Promise.all([
        diskCache.get('key1'),
        diskCache.get('key2'),
        diskCache.get('key3'),
      ])

      // Assert
      expect(result1).toBe('data')
      expect(result2).toBe('data')
      expect(result3).toBe('data')
      expect(mockCounters.countRead).toHaveBeenCalledTimes(3)
      expect(mockCounters.countHit).toHaveBeenCalledTimes(3)
    })

    it('should handle multiple concurrent set operations', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      const [result1, result2, result3] = await Promise.all([
        diskCache.set('key1', 'value1'),
        diskCache.set('key2', 'value2'),
        diskCache.set('key3', 'value3'),
      ])

      // Assert
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledTimes(3)
    })

    it('should maintain separate stats for different operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockWriteFile.mockResolvedValue(undefined)

      // Act
      await diskCache.get('key1')
      await diskCache.set('key2', 'value')
      await diskCache.get('key3')

      // Assert
      expect(mockCounters.countRead).toHaveBeenCalledTimes(2)
    })
  })
})
