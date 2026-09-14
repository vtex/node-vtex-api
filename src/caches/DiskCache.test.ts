import { DiskCache } from './DiskCache'
import * as fsExtra from 'fs-extra'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('rwlock')

describe('DiskCache', () => {
  let diskCache: DiskCache<string>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockPathExistsSync: jest.Mock
  let mockReadLock: jest.Mock
  let mockWriteLock: jest.Mock
  let mockLockInstance: any

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup fs-extra mocks
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockPathExistsSync = jest.fn()
    ;(fsExtra.readJSON as jest.Mock) = mockReadFile
    ;(fsExtra.outputJSON as jest.Mock) = mockWriteFile
    ;(fsExtra.pathExistsSync as jest.Mock) = mockPathExistsSync

    // Setup ReadWriteLock mocks
    mockReadLock = jest.fn()
    mockWriteLock = jest.fn()
    mockLockInstance = {
      readLock: mockReadLock,
      writeLock: mockWriteLock,
    }
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => mockLockInstance)

    // Create instance with test path
    diskCache = new DiskCache('/test/cache')
  })

  describe('constructor', () => {
    it('should initialize with cachePath and default file operations', () => {
      // Act
      const cache = new DiskCache('/cache/path')

      // Assert
      expect(cache).toBeDefined()
    })

    it('should initialize with custom readFile and writeFile functions', () => {
      // Arrange
      const customRead = jest.fn()
      const customWrite = jest.fn()

      // Act
      const cache = new DiskCache('/cache/path', customRead, customWrite)

      // Assert
      expect(cache).toBeDefined()
    })

    it('should create a ReadWriteLock instance', () => {
      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when file exists', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)

      // Act
      const result = diskCache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith('/test/cache/test-key')
    })

    it('should return false when file does not exist', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has('nonexistent-key')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle empty key string', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(false)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockPathExistsSync).toHaveBeenCalledWith('/test/cache/')
    })

    it('should handle key with path separators', () => {
      // Arrange
      mockPathExistsSync.mockReturnValue(true)

      // Act
      const result = diskCache.has('nested/path/key')

      // Assert
      expect(result).toBe(true)
      expect(mockPathExistsSync).toHaveBeenCalledWith('/test/cache/nested/path/key')
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      ;(diskCache as any).hits = 5
      ;(diskCache as any).total = 10

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 5,
        total: 10,
        name: 'disk-cache',
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      ;(diskCache as any).hits = 3
      ;(diskCache as any).total = 7

      // Act
      const stats = diskCache.getStats('custom-cache')

      // Assert
      expect(stats).toEqual({
        hits: 3,
        total: 7,
        name: 'custom-cache',
      })
    })

    it('should reset reported stats after call', () => {
      // Arrange
      ;(diskCache as any).hits = 10
      ;(diskCache as any).total = 20

      // Act
      diskCache.getStats()
      const secondStats = diskCache.getStats()

      // Assert
      expect(secondStats).toEqual({
        hits: 0,
        total: 0,
        name: 'disk-cache',
      })
    })

    it('should calculate delta between calls', () => {
      // Arrange
      ;(diskCache as any).hits = 5
      ;(diskCache as any).total = 10

      // Act - first call
      diskCache.getStats()
      // Increment stats
      ;(diskCache as any).hits = 8
      ;(diskCache as any).total = 15
      // Second call
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 3,
        total: 5,
        name: 'disk-cache',
      })
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
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

    it('should not reset stats after call', () => {
      // Arrange
      ;(diskCache as any).hits = 10
      ;(diskCache as any).total = 20

      // Act
      diskCache.getCumulativeStats()
      const secondStats = diskCache.getCumulativeStats()

      // Assert
      expect(secondStats).toEqual({
        hits: 10,
        total: 20,
      })
    })

    it('should return zeros initially', () => {
      // Act
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
      })
    })
  })

  describe('get', () => {
    it('should successfully read file and increment hits', async () => {
      // Arrange
      const testValue = 'test-data'
      mockReadFile.mockResolvedValue(testValue)
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get('test-key')

      // Assert
      expect(result).toBe(testValue)
      expect((diskCache as any).hits).toBe(1)
      expect((diskCache as any).total).toBe(1)
    })

    it('should increment total on each call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.get('key3')

      // Assert
      expect((diskCache as any).total).toBe(3)
    })

    it('should not increment hits on file read error', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get('nonexistent-key')

      // Assert
      expect(result).toBeUndefined()
      expect((diskCache as any).hits).toBe(0)
      expect((diskCache as any).total).toBe(1)
    })

    it('should release read lock on success', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockReadFile.mockResolvedValue('data')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should release read lock on error', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Error'))
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should use correct path for file read', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get('my-key')

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith('/test/cache/my-key')
    })

    it('should handle nested key paths', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get('nested/path/key')

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith('/test/cache/nested/path/key')
    })

    it('should acquire read lock with correct key', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get('lock-key')

      // Assert
      expect(mockReadLock).toHaveBeenCalledWith(
        'lock-key',
        expect.any(Function)
      )
    })

    it('should handle empty key', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get('')

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith('/test/cache/')
    })

    it('should handle complex object values', async () => {
      // Arrange
      const complexValue = { nested: { data: 'value' }, array: [1, 2, 3] }
      mockReadFile.mockResolvedValue(complexValue)
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.get('complex-key')

      // Assert
      expect(result).toEqual(complexValue)
    })
  })

  describe('set', () => {
    it('should successfully write file and return true', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(true)
    })

    it('should return false on write error', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(false)
    })

    it('should release write lock on success', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.set('test-key', 'test-value')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should release write lock on error', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Error'))
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.set('test-key', 'test-value')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should use correct path for file write', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.set('my-key', 'my-value')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/my-key', 'my-value')
    })

    it('should handle nested key paths', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.set('nested/path/key', 'value')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/nested/path/key', 'value')
    })

    it('should acquire write lock with correct key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.set('lock-key', 'value')

      // Assert
      expect(mockWriteLock).toHaveBeenCalledWith(
        'lock-key',
        expect.any(Function)
      )
    })

    it('should handle empty key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.set('', 'value')

      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/', 'value')
    })

    it('should handle complex object values', async () => {
      // Arrange
      const complexValue = { nested: { data: 'value' }, array: [1, 2, 3] }
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set('complex-key', complexValue as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/complex-key', complexValue)
    })

    it('should handle null value', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set('null-key', null as any)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/test/cache/null-key', null)
    })

    it('should handle promise rejection from writeFile', async () => {
      // Arrange
      const error = new Error('Permission denied')
      mockWriteFile.mockRejectedValue(error)
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const result = await diskCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('integration scenarios', () => {
    it('should track hits and misses correctly across multiple operations', async () => {
      // Arrange
      mockReadFile
        .mockResolvedValueOnce('value1')
        .mockRejectedValueOnce(new Error('miss'))
        .mockResolvedValueOnce('value3')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      await diskCache.get('key1') // hit
      await diskCache.get('key2') // miss
      await diskCache.get('key3') // hit

      // Assert
      expect((diskCache as any).hits).toBe(2)
      expect((diskCache as any).total).toBe(3)
    })

    it('should handle interleaved reads and writes', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('read-value')
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )
      mockWriteLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )

      // Act
      const read1 = diskCache.get('key1')
      const write1 = diskCache.set('key2', 'value')
      const read2 = diskCache.get('key3')
      const write2 = diskCache.set('key4', 'value')

      const results = await Promise.all([read1, write1, read2, write2])

      // Assert
      expect(results).toHaveLength(4)
      expect((diskCache as any).total).toBe(2) // 2 reads
      expect((diskCache as any).hits).toBe(2) // 2 hits
    })

    it('should correctly report stats and reset them', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('data')
      mockReadLock.mockImplementation(
        (key: string, callback: (release: () => void) => Promise<void>) => {
          callback(() => {})
        }
      )
      await diskCache.get('key1')
      await diskCache.get('key2')

      // Act
      const firstStats = diskCache.getStats('test-cache')
      const cumulativeStats = diskCache.getCumulativeStats()
      const secondStats = diskCache.getStats('test-cache')

      // Assert
      expect(firstStats).toEqual({
        hits: 2,
        total: 2,
        name: 'test-cache',
      })
      expect(cumulativeStats).toEqual({
        hits: 2,
        total: 2,
      })
      expect(secondStats).toEqual({
        hits: 0,
        total: 0,
        name: 'test-cache',
      })
    })
  })
})
