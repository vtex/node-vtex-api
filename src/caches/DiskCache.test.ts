import { DiskCache } from './DiskCache'
import { WindowedCounters } from './WindowedCounters'
import * as fsExtra from 'fs-extra'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('./WindowedCounters')
jest.mock('rwlock')

describe('DiskCache', () => {
  let diskCache: DiskCache<string>
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockReadLock: jest.Mock
  let mockWindowedCounters: jest.Mocked<WindowedCounters>
  let lockInstance: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()
    
    mockWindowedCounters = {
      countRead: jest.fn(),
      countHit: jest.fn(),
      countMiss: jest.fn(),
      windowed: jest.fn().mockReturnValue({ hits: 10, total: 20 }),
      cumulative: jest.fn().mockReturnValue({ hits: 100, misses: 50, total: 150 })
    } as any
    
    ;(WindowedCounters as jest.Mock).mockImplementation(() => mockWindowedCounters)
    
    lockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn()
    }
    ;(ReadWriteLock as jest.Mock).mockImplementation(() => lockInstance)
    
    diskCache = new DiskCache('/cache/path', mockReadFile, mockWriteFile)
  })

  describe('constructor', () => {
    it('should initialize with default fs-extra functions when not provided', () => {
      // Arrange & Act
      const cache = new DiskCache('/some/path')
      
      // Assert
      expect(cache).toBeInstanceOf(DiskCache)
    })

    it('should initialize with custom readFile and writeFile functions', () => {
      // Arrange & Act
      const customRead = jest.fn()
      const customWrite = jest.fn()
      const cache = new DiskCache('/cache', customRead, customWrite)
      
      // Assert
      expect(cache).toBeInstanceOf(DiskCache)
    })

    it('should create a ReadWriteLock instance', () => {
      // Arrange & Act
      new DiskCache('/cache/path')
      
      // Assert
      expect(ReadWriteLock).toHaveBeenCalled()
    })

    it('should create a WindowedCounters instance', () => {
      // Arrange & Act
      new DiskCache('/cache/path')
      
      // Assert
      expect(WindowedCounters).toHaveBeenCalled()
    })
  })

  describe('has', () => {
    it('should return true when file exists at key path', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      
      // Act
      const result = diskCache.has('mykey')
      
      // Assert
      expect(result).toBe(true)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(join('/cache/path', 'mykey'))
    })

    it('should return false when file does not exist at key path', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)
      
      // Act
      const result = diskCache.has('nonexistent')
      
      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(join('/cache/path', 'nonexistent'))
    })

    it('should handle empty string keys', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(false)
      
      // Act
      const result = diskCache.has('')
      
      // Assert
      expect(result).toBe(false)
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(join('/cache/path', ''))
    })

    it('should handle keys with special characters', () => {
      // Arrange
      ;(fsExtra.pathExistsSync as jest.Mock).mockReturnValue(true)
      
      // Act
      diskCache.has('key/with/slashes')
      
      // Assert
      expect(fsExtra.pathExistsSync).toHaveBeenCalledWith(join('/cache/path', 'key/with/slashes'))
    })
  })

  describe('getStats', () => {
    it('should return stats with default name', () => {
      // Arrange
      mockWindowedCounters.windowed.mockReturnValue({ hits: 5, total: 10 })
      
      // Act
      const stats = diskCache.getStats()
      
      // Assert
      expect(stats).toEqual({
        hits: 5,
        total: 10,
        name: 'disk-cache'
      })
    })

    it('should return stats with custom name', () => {
      // Arrange
      mockWindowedCounters.windowed.mockReturnValue({ hits: 3, total: 7 })
      
      // Act
      const stats = diskCache.getStats('custom-cache')
      
      // Assert
      expect(stats).toEqual({
        hits: 3,
        total: 7,
        name: 'custom-cache'
      })
    })

    it('should call windowed on counters', () => {
      // Arrange & Act
      diskCache.getStats()
      
      // Assert
      expect(mockWindowedCounters.windowed).toHaveBeenCalled()
    })

    it('should return stats with zero values', () => {
      // Arrange
      mockWindowedCounters.windowed.mockReturnValue({ hits: 0, total: 0 })
      
      // Act
      const stats = diskCache.getStats('empty')
      
      // Assert
      expect(stats).toEqual({
        hits: 0,
        total: 0,
        name: 'empty'
      })
    })
  })

  describe('getCumulativeStats', () => {
    it('should return cumulative stats', () => {
      // Arrange
      mockWindowedCounters.cumulative.mockReturnValue({ hits: 100, misses: 50, total: 150 })
      
      // Act
      const stats = diskCache.getCumulativeStats()
      
      // Assert
      expect(stats).toEqual({
        hits: 100,
        misses: 50,
        total: 150
      })
    })

    it('should call cumulative on counters', () => {
      // Arrange & Act
      diskCache.getCumulativeStats()
      
      // Assert
      expect(mockWindowedCounters.cumulative).toHaveBeenCalled()
    })

    it('should return stats with zero values', () => {
      // Arrange
      mockWindowedCounters.cumulative.mockReturnValue({ hits: 0, misses: 0, total: 0 })
      
      // Act
      const stats = diskCache.getCumulativeStats()
      
      // Assert
      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        total: 0
      })
    })
  })

  describe('get', () => {
    it('should successfully read and return data on cache hit', async () => {
      // Arrange
      const testData = 'cached-value'
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      mockReadFile.mockResolvedValue(testData)
      
      // Act
      const getPromise = diskCache.get('testkey')
      await readLockCallback(jest.fn())
      const result = await getPromise
      
      // Assert
      expect(result).toBe(testData)
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
      expect(mockWindowedCounters.countHit).toHaveBeenCalled()
      expect(mockWindowedCounters.countMiss).not.toHaveBeenCalled()
    })

    it('should handle cache miss when file read fails', async () => {
      // Arrange
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      mockReadFile.mockRejectedValue(new Error('File not found'))
      
      // Act
      const getPromise = diskCache.get('missingkey')
      await readLockCallback(jest.fn())
      const result = await getPromise
      
      // Assert
      expect(result).toBeNull()
      expect(mockWindowedCounters.countRead).toHaveBeenCalled()
      expect(mockWindowedCounters.countMiss).toHaveBeenCalled()
      expect(mockWindowedCounters.countHit).not.toHaveBeenCalled()
    })

    it('should release read lock after successful read', async () => {
      // Arrange
      const releaseFn = jest.fn()
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      mockReadFile.mockResolvedValue('data')
      
      // Act
      const getPromise = diskCache.get('key')
      await readLockCallback(releaseFn)
      await getPromise
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release read lock after read failure', async () => {
      // Arrange
      const releaseFn = jest.fn()
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      mockReadFile.mockRejectedValue(new Error('Read error'))
      
      // Act
      const getPromise = diskCache.get('key')
      await readLockCallback(releaseFn)
      await getPromise
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should use the provided readFile function', async () => {
      // Arrange
      const testData = 'value'
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      mockReadFile.mockResolvedValue(testData)
      
      // Act
      const getPromise = diskCache.get('key')
      await readLockCallback(jest.fn())
      await getPromise
      
      // Assert
      expect(mockReadFile).toHaveBeenCalledWith(join('/cache/path', 'key'))
    })

    it('should acquire read lock with correct key', async () => {
      // Arrange
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      mockReadFile.mockResolvedValue('data')
      
      // Act
      const getPromise = diskCache.get('testkey123')
      await readLockCallback(jest.fn())
      await getPromise
      
      // Assert
      expect(lockInstance.readLock).toHaveBeenCalledWith('testkey123', expect.any(Function))
    })

    it('should return undefined on error', async () => {
      // Arrange
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      mockReadFile.mockRejectedValue(new Error('Unexpected error'))
      
      // Act
      const getPromise = diskCache.get('key')
      await readLockCallback(jest.fn())
      const result = await getPromise
      
      // Assert
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should successfully write data and return true', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(undefined)
      
      // Act
      const setPromise = diskCache.set('key', 'value')
      await writeLockCallback(jest.fn())
      const result = await setPromise
      
      // Assert
      expect(result).toBe(true)
    })

    it('should return false on write failure', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      
      // Act
      const setPromise = diskCache.set('key', 'value')
      await writeLockCallback(jest.fn())
      const result = await setPromise
      
      // Assert
      expect(result).toBe(false)
    })

    it('should release write lock after successful write', async () => {
      // Arrange
      const releaseFn = jest.fn()
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(undefined)
      
      // Act
      const setPromise = diskCache.set('key', 'value')
      await writeLockCallback(releaseFn)
      await setPromise
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should release write lock after write failure', async () => {
      // Arrange
      const releaseFn = jest.fn()
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockRejectedValue(new Error('Write error'))
      
      // Act
      const setPromise = diskCache.set('key', 'value')
      await writeLockCallback(releaseFn)
      await setPromise
      
      // Assert
      expect(releaseFn).toHaveBeenCalled()
    })

    it('should use the provided writeFile function', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(undefined)
      const testValue = 'test-data'
      
      // Act
      const setPromise = diskCache.set('key', testValue)
      await writeLockCallback(jest.fn())
      await setPromise
      
      // Assert
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'key'), testValue)
    })

    it('should acquire write lock with correct key', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(undefined)
      
      // Act
      const setPromise = diskCache.set('mykey', 'value')
      await writeLockCallback(jest.fn())
      await setPromise
      
      // Assert
      expect(lockInstance.writeLock).toHaveBeenCalledWith('mykey', expect.any(Function))
    })

    it('should handle write with empty string key', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(undefined)
      
      // Act
      const setPromise = diskCache.set('', 'value')
      await writeLockCallback(jest.fn())
      const result = await setPromise
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', ''), 'value')
    })

    it('should handle write with null value', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(undefined)
      
      // Act
      const setPromise = diskCache.set('key', null as any)
      await writeLockCallback(jest.fn())
      const result = await setPromise
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'key'), null)
    })

    it('should handle write with complex object', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(undefined)
      const complexValue = { nested: { data: [1, 2, 3] } }
      
      // Act
      const setPromise = diskCache.set('key', complexValue as any)
      await writeLockCallback(jest.fn())
      const result = await setPromise
      
      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalledWith(join('/cache/path', 'key'), complexValue)
    })

    it('should return false when writeFile resolves with true (failure indicator)', async () => {
      // Arrange
      let writeLockCallback: any
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockWriteFile.mockResolvedValue(true)
      
      // Act
      const setPromise = diskCache.set('key', 'value')
      await writeLockCallback(jest.fn())
      const result = await setPromise
      
      // Assert
      expect(result).toBe(false)
    })
  })

  describe('integration scenarios', () => {
    it('should handle sequential get and set operations', async () => {
      // Arrange
      let readLockCallback: any
      let writeLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      lockInstance.writeLock.mockImplementation((key: string, callback: Function) => {
        writeLockCallback = callback
      })
      mockReadFile.mockResolvedValue('initial')
      mockWriteFile.mockResolvedValue(undefined)
      
      // Act & Assert - Set
      const setPromise = diskCache.set('key', 'updated')
      await writeLockCallback(jest.fn())
      const setResult = await setPromise
      expect(setResult).toBe(true)
      
      // Act & Assert - Get
      mockReadFile.mockResolvedValue('updated')
      const getPromise = diskCache.get('key')
      await readLockCallback(jest.fn())
      const getResult = await getPromise
      expect(getResult).toBe('updated')
    })

    it('should track hits and misses correctly across operations', async () => {
      // Arrange
      let readLockCallback: any
      lockInstance.readLock.mockImplementation((key: string, callback: Function) => {
        readLockCallback = callback
      })
      
      // Act & Assert - First get (hit)
      mockReadFile.mockResolvedValue('data')
      const getPromise1 = diskCache.get('key1')
      await readLockCallback(jest.fn())
      await getPromise1
      
      // Act & Assert - Second get (miss)
      mockReadFile.mockRejectedValue(new Error('Not found'))
      const getPromise2 = diskCache.get('key2')
      await readLockCallback(jest.fn())
      await getPromise2
      
      expect(mockWindowedCounters.countHit).toHaveBeenCalledTimes(1)
      expect(mockWindowedCounters.countMiss).toHaveBeenCalledTimes(1)
      expect(mockWindowedCounters.countRead).toHaveBeenCalledTimes(2)
    })
  })
})
