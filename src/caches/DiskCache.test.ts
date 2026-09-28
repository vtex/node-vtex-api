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
  let mockWriteLockInstance: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    mockReadLockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    }
    mockReadLock = jest.fn(() => mockReadLockInstance)
    ;(ReadWriteLock as jest.Mock).mockImplementation(mockReadLock)
  })

  describe('constructor', () => {
    it('should initialize with cache path and default file handlers', () => {
      // Arrange & Act
      diskCache = new DiskCache<string>('/cache/path')

      // Assert
      expect(diskCache).toBeInstanceOf(DiskCache)
      expect(mockReadLock).toHaveBeenCalledTimes(1)
    })

    it('should initialize with custom read and write handlers', () => {
      // Arrange & Act
      diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)

      // Assert
      expect(diskCache).toBeInstanceOf(DiskCache)
    })

    it('should create a ReadWriteLock instance', () => {
      // Arrange & Act
      diskCache = new DiskCache<string>('/cache/path')

      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should return true when file exists', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)

      // Act
      const result = diskCache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(join('/cache/path', 'test-key'))
    })

    it('should return false when file does not exist', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)

      // Act
      const result = diskCache.has('nonexistent-key')

      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(join('/cache/path', 'nonexistent-key'))
    })

    it('should handle empty string keys', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)

      // Act
      const result = diskCache.has('')

      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith('/cache/path')
    })

    it('should handle keys with path separators', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      const key = 'nested/path/key'

      // Act
      const result = diskCache.has(key)

      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(join('/cache/path', key))
    })
  })

  describe('get', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should return data when file is successfully read', async () => {
      // Arrange
      const testData = 'cached-value'
      mockReadFile.mockResolvedValue(testData)
      let capturedRelease: (() => void) | undefined
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          capturedRelease = jest.fn()
          callback(capturedRelease)
        }
      )

      // Act
      const promise = diskCache.get('test-key')
      await promise

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith(join('/cache/path', 'test-key'))
      expect(capturedRelease).toHaveBeenCalled()
    })

    it('should increment total counter on each get', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(2)
    })

    it('should increment hits counter when file is successfully read', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      await diskCache.get('key1')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(1)
    })

    it('should return undefined when read file fails', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('File not found'))
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.get('missing-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should release lock after successful read', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should release lock after read failure', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockReadFile.mockRejectedValue(new Error('Read failed'))
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.get('test-key')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should not increment hits when read fails', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('Failed'))
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      await diskCache.get('key1')
      await diskCache.get('key2')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(2)
    })

    it('should handle empty string keys', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.get('')

      // Assert
      expect(mockReadFile).toHaveBeenCalledWith('/cache/path')
      expect(result).toBe('value')
    })
  })

  describe('set', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should write value to file successfully', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'test-key'), 'test-value')
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.set('test-key', 'test-value')

      // Assert
      expect(result).toBe(false)
    })

    it('should release lock after successful write', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.set('test-key', 'test-value')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should release lock after write failure', async () => {
      // Arrange
      const mockRelease = jest.fn()
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(mockRelease)
        }
      )

      // Act
      await diskCache.set('test-key', 'test-value')

      // Assert
      expect(mockRelease).toHaveBeenCalled()
    })

    it('should handle setting empty string keys', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.set('', 'test-value')

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith('/cache/path', 'test-value')
    })

    it('should handle setting null values', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.set('test-key', null as unknown as string)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'test-key'), null)
    })

    it('should handle setting undefined values', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.set('test-key', undefined as unknown as string)

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'test-key'), undefined)
    })

    it('should handle setting empty string values', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      const result = await diskCache.set('test-key', '')

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'test-key'), '')
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should return stats with default name', () => {
      // Arrange & Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
        name: 'disk-cache',
      })
    })

    it('should return stats with custom name', () => {
      // Arrange & Act
      const stats = diskCache.getStats('custom-cache')

      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
        name: 'custom-cache',
      })
    })

    it('should return delta stats since last report', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )
      await diskCache.get('key1')
      await diskCache.get('key2')
      diskCache.getStats()

      // Act
      await diskCache.get('key3')
      const stats = diskCache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
      expect(stats.total).toBe(1)
    })

    it('should reset reported stats after getStats call', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )
      await diskCache.get('key1')

      // Act
      diskCache.getStats()
      const secondCall = diskCache.getStats()

      // Assert
      expect(secondCall.hits).toBe(0)
      expect(secondCall.total).toBe(0)
    })

    it('should track failed gets in total but not in hits', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('Failed'))
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )
      await diskCache.get('key1')
      await diskCache.get('key2')
      await diskCache.get('key3')

      // Act
      const stats = diskCache.getStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(0)
    })
  })

  describe('getCumulativeStats', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should return cumulative stats without resetting', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )
      await diskCache.get('key1')
      await diskCache.get('key2')

      // Act
      const stats1 = diskCache.getCumulativeStats()
      const stats2 = diskCache.getCumulativeStats()

      // Assert
      expect(stats1).toEqual(stats2)
      expect(stats1.total).toBe(2)
      expect(stats1.hits).toBe(2)
    })

    it('should include all hits and total operations', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      await diskCache.get('key1') // hit
      await diskCache.get('key2') // hit
      mockReadFile.mockRejectedValue(new Error('Failed'))
      await diskCache.get('key3') // miss
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.hits).toBe(2)
    })

    it('should not reset counters after getCumulativeStats', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('value')
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )
      await diskCache.get('key1')
      diskCache.getCumulativeStats()

      // Act
      await diskCache.get('key2')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(() => {
      diskCache = new DiskCache<string>('/cache/path', mockReadFile, mockWriteFile)
    })

    it('should handle multiple gets and sets with proper lock handling', async () => {
      // Arrange
      mockReadFile.mockResolvedValue('cached')
      mockWriteFile.mockResolvedValue(undefined)
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )
      mockReadLockInstance.writeLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )

      // Act
      await diskCache.set('key1', 'value1')
      const value1 = await diskCache.get('key1')
      await diskCache.set('key2', 'value2')
      const value2 = await diskCache.get('key2')
      const stats = diskCache.getCumulativeStats()

      // Assert
      expect(value1).toBe('cached')
      expect(value2).toBe('cached')
      expect(stats.total).toBe(2)
      expect(stats.hits).toBe(2)
    })

    it('should track stats correctly through mixed success and failure scenarios', async () => {
      // Arrange
      mockReadLockInstance.readLock.mockImplementation(
        (_key: string, callback: (release: () => void) => void) => {
          callback(jest.fn())
        }
      )
      mockReadFile.mockResolvedValue('value')

      // Act
      await diskCache.get('key1') // hit
      const stats1 = diskCache.getStats()
      await diskCache.get('key2') // hit
      mockReadFile.mockRejectedValue(new Error('Failed'))
      await diskCache.get('key3') // miss
      const stats2 = diskCache.getStats()
      await diskCache.get('key4') // miss
      const stats3 = diskCache.getStats()

      // Assert
      expect(stats1.hits).toBe(1)
      expect(stats1.total).toBe(1)
      expect(stats2.hits).toBe(1)
      expect(stats2.total).toBe(2)
      expect(stats3.hits).toBe(0)
      expect(stats3.total).toBe(1)
    })
  })
})
