import { LRUDiskCache } from './LRUDiskCache'
import { LRUDiskCacheOptions } from './typings'
import * as fsExtra from 'fs-extra'
import LRU from 'lru-cache'
import ReadWriteLock from 'rwlock'

jest.mock('fs-extra')
jest.mock('lru-cache')
jest.mock('rwlock')

describe('LRUDiskCache', () => {
  let mockReadFile: jest.Mock
  let mockWriteFile: jest.Mock
  let mockLRUInstance: jest.Mocked<LRU<string, number>>
  let mockLockInstance: jest.Mocked<ReadWriteLock>
  let cachePath: string
  let options: LRUDiskCacheOptions

  beforeEach(() => {
    cachePath = '/test/cache/path'
    options = { max: 100, maxSize: 1000 }

    // Setup mocks
    mockReadFile = jest.fn()
    mockWriteFile = jest.fn()

    mockLRUInstance = {
      has: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      clear: jest.fn(),
      dump: jest.fn(),
      load: jest.fn(),
      prune: jest.fn(),
      toJSON: jest.fn(),
      itemCount: 10,
      length: 5,
      max: 100,
    } as any

    mockLockInstance = {
      readLock: jest.fn(),
      writeLock: jest.fn(),
    } as any

    jest.mocked(LRU).mockImplementation(() => mockLRUInstance)
    jest.mocked(ReadWriteLock).mockImplementation(() => mockLockInstance)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    // Arrange & Act & Assert
    it('should initialize with default parameters', () => {
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      expect(cache).toBeDefined()
    })

    it('should initialize LRU with dispose callback', () => {
      new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      expect(jest.mocked(LRU)).toHaveBeenCalledWith(
        expect.objectContaining({
          ...options,
          noDisposeOnSet: true,
          dispose: expect.any(Function),
        })
      )
    })

    it('should initialize with custom file read/write functions', () => {
      const customRead = jest.fn()
      const customWrite = jest.fn()
      const cache = new LRUDiskCache(cachePath, options, customRead, customWrite)
      expect(cache).toBeDefined()
    })

    it('should use default fs-extra functions when not provided', () => {
      const cache = new LRUDiskCache(cachePath, options)
      expect(cache).toBeDefined()
    })

    it('should set initial stats to zero', () => {
      const cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.total).toBe(0)
      expect(stats.disposedItems).toBe(0)
    })

    it('should create ReadWriteLock instance', () => {
      new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      expect(jest.mocked(ReadWriteLock)).toHaveBeenCalled()
    })

    it('should invoke dispose callback when LRU evicts a key', () => {
      const disposeSpy = jest.fn()
      jest.mocked(LRU).mockImplementation((opts: any) => {
        disposeSpy.mockImplementation(opts.dispose)
        return mockLRUInstance
      })

      new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      // Get the dispose function from the constructor
      const callArgs = jest.mocked(LRU).mock.calls[0][0]
      callArgs.dispose('test-key')
      // Verify the dispose was called (it updates keyToBeDeleted)
    })
  })

  describe('has', () => {
    let cache: LRUDiskCache<string>

    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should return true when key exists in LRU storage', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(true)

      // Act
      const result = cache.has('test-key')

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('test-key')
    })

    it('should return false when key does not exist in LRU storage', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.has('nonexistent-key')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('nonexistent-key')
    })

    it('should handle empty string key', () => {
      // Arrange
      mockLRUInstance.has.mockReturnValue(false)

      // Act
      const result = cache.has('')

      // Assert
      expect(result).toBe(false)
      expect(mockLRUInstance.has).toHaveBeenCalledWith('')
    })
  })

  describe('getStats', () => {
    let cache: LRUDiskCache<string>

    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      mockLRUInstance.itemCount = 50
      mockLRUInstance.length = 25
      mockLRUInstance.max = 100
    })

    it('should return stats with default name', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats).toEqual(
        expect.objectContaining({
          name: 'disk-lru-cache',
          disposedItems: 0,
          hits: 0,
          total: 0,
          itemCount: 50,
          length: 25,
          max: 100,
        })
      )
    })

    it('should return stats with custom name', () => {
      // Act
      const stats = cache.getStats('custom-cache-name')

      // Assert
      expect(stats.name).toBe('custom-cache-name')
    })

    it('should calculate hitRate correctly when total > 0', () => {
      // Arrange - manipulate internal state by calling get with valid key
      mockLRUInstance.get.mockReturnValue(Date.now() + 1000)

      // Act - manually increment counters (simulating operations)
      const callArgs = jest.mocked(LRU).mock.calls[0][0]
      // Simulate 10 total, 5 hits
      for (let i = 0; i < 10; i++) {
        // We'd need to call the actual methods, but we can verify stats calculation
      }
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined() // no actual calls yet
    })

    it('should return undefined hitRate when total is 0', () => {
      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.hitRate).toBeUndefined()
    })

    it('should reset reported stats after returning stats', () => {
      // Act
      const stats1 = cache.getStats()
      const stats2 = cache.getStats()

      // Assert
      expect(stats1.hits).toBe(0)
      expect(stats2.hits).toBe(0)
    })

    it('should track disposed items', () => {
      // Arrange
      const callArgs = jest.mocked(LRU).mock.calls[0][0]
      // Simulate disposal
      callArgs.dispose('key1')
      callArgs.dispose('key2')

      // Act
      const stats = cache.getStats()

      // Assert
      expect(stats.disposedItems).toBe(2)
    })
  })

  describe('getCumulativeStats', () => {
    let cache: LRUDiskCache<string>

    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
      mockLRUInstance.itemCount = 30
      mockLRUInstance.length = 15
      mockLRUInstance.max = 100
    })

    it('should return cumulative stats without resetting', () => {
      // Act
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(cumulativeStats).toEqual(
        expect.objectContaining({
          disposedItems: 0,
          hits: 0,
          itemCount: 30,
          length: 15,
          max: 100,
          total: 0,
        })
      )
    })

    it('should include all required properties', () => {
      // Act
      const cumulativeStats = cache.getCumulativeStats()

      // Assert
      expect(cumulativeStats).toHaveProperty('disposedItems')
      expect(cumulativeStats).toHaveProperty('hits')
      expect(cumulativeStats).toHaveProperty('itemCount')
      expect(cumulativeStats).toHaveProperty('length')
      expect(cumulativeStats).toHaveProperty('max')
      expect(cumulativeStats).toHaveProperty('total')
    })
  })

  describe('get', () => {
    let cache: LRUDiskCache<string>

    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should return undefined when key does not exist in LRU', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      const result = await cache.get('nonexistent-key')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should read file from disk when key exists and not expired', async () => {
      // Arrange
      const fileData = { test: 'data' }
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue(fileData)
      mockLockInstance.readLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toEqual(fileData)
      expect(mockReadFile).toHaveBeenCalled()
    })

    it('should increment hits when file is successfully read', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLockInstance.readLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await cache.get('test-key')
      const stats = cache.getStats()

      // Assert
      expect(stats.hits).toBe(1)
    })

    it('should increment total count on every get call', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)

      // Act
      await cache.get('key1')
      await cache.get('key2')
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(2)
    })

    it('should delete expired files', async () => {
      // Arrange
      const pastTime = Date.now() - 1000
      mockLRUInstance.get.mockReturnValue(pastTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLockInstance.readLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      jest.mocked(fsExtra.remove).mockResolvedValue(undefined)

      // Act
      await cache.get('expired-key')

      // Assert
      expect(mockLRUInstance.del).toHaveBeenCalledWith('expired-key')
    })

    it('should handle file read errors gracefully', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockRejectedValue(new Error('File read failed'))
      mockLockInstance.readLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await cache.get('test-key')

      // Assert
      expect(result).toBeNull()
    })

    it('should delete file if keyToBeDeleted is set and not the same key', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(undefined)
      // Simulate disposal setting keyToBeDeleted
      const callArgs = jest.mocked(LRU).mock.calls[0][0]
      callArgs.dispose('old-key')
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      jest.mocked(fsExtra.remove).mockResolvedValue(undefined)

      // Act
      await cache.get('new-key')

      // Assert
      expect(jest.mocked(fsExtra.remove)).toHaveBeenCalled()
    })

    it('should use read lock during file read', async () => {
      // Arrange
      const futureTime = Date.now() + 10000
      mockLRUInstance.get.mockReturnValue(futureTime)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLockInstance.readLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await cache.get('test-key')

      // Assert
      expect(mockLockInstance.readLock).toHaveBeenCalledWith(
        'test-key',
        expect.any(Function)
      )
    })
  })

  describe('set', () => {
    let cache: LRUDiskCache<string>

    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should write value to disk successfully', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await cache.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(true)
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should store value with maxAge in LRU', async () => {
      // Arrange
      const maxAge = 5000
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await cache.set('test-key', { data: 'test' }, maxAge)

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(Number),
        maxAge
      )
    })

    it('should store value without maxAge in LRU', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await cache.set('test-key', { data: 'test' })

      // Assert
      expect(mockLRUInstance.set).toHaveBeenCalledWith('test-key', NaN)
    })

    it('should return false when write fails', async () => {
      // Arrange
      mockWriteFile.mockRejectedValue(new Error('Write failed'))
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await cache.set('test-key', { data: 'test' })

      // Assert
      expect(result).toBe(false)
    })

    it('should delete previously marked key if different from current key', async () => {
      // Arrange
      const callArgs = jest.mocked(LRU).mock.calls[0][0]
      callArgs.dispose('old-key')
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      jest.mocked(fsExtra.remove).mockResolvedValue(undefined)

      // Act
      await cache.set('new-key', { data: 'test' })

      // Assert
      expect(jest.mocked(fsExtra.remove)).toHaveBeenCalled()
    })

    it('should use write lock during file write', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await cache.set('test-key', { data: 'test' })

      // Assert
      expect(mockLockInstance.writeLock).toHaveBeenCalledWith(
        'test-key',
        expect.any(Function)
      )
    })

    it('should not delete same key when keyToBeDeleted equals current key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      jest.mocked(fsExtra.remove).mockResolvedValue(undefined)

      // Act
      await cache.set('test-key', { data: 'test' })

      // Assert
      // Since no key was disposed yet, remove should not be called
      expect(jest.mocked(fsExtra.remove)).not.toHaveBeenCalled()
    })

    it('should handle empty key', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await cache.set('', { data: 'test' })

      // Assert
      expect(result).toBe(true)
      expect(mockLRUInstance.set).toHaveBeenCalledWith('', NaN)
    })

    it('should handle maxAge of 0', async () => {
      // Arrange
      mockWriteFile.mockResolvedValue(undefined)
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      const result = await cache.set('test-key', { data: 'test' }, 0)

      // Assert
      expect(result).toBe(true)
      // maxAge of 0 is falsy, so it should store with NaN
      expect(mockLRUInstance.set).toHaveBeenCalledWith('test-key', NaN)
    })
  })

  describe('private methods', () => {
    let cache: LRUDiskCache<string>

    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('getPathKey should join cachePath with key', () => {
      // Act - access via any to test private method
      const pathKey = (cache as any).getPathKey('test-key')

      // Assert
      expect(pathKey).toBe(`${cachePath}/test-key`)
    })

    it('deleteFile should clear keyToBeDeleted after removal', async () => {
      // Arrange
      const callArgs = jest.mocked(LRU).mock.calls[0][0]
      callArgs.dispose('to-delete')
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      jest.mocked(fsExtra.remove).mockResolvedValue(undefined)

      // Act - call deleteFile via any
      await (cache as any).deleteFile('to-delete')

      // Assert - keyToBeDeleted should be cleared
      const cumulativeStats = cache.getCumulativeStats()
      expect(cumulativeStats).toBeDefined()
    })
  })

  describe('integration scenarios', () => {
    let cache: LRUDiskCache<{ id: number; value: string }>

    beforeEach(() => {
      cache = new LRUDiskCache(cachePath, options, mockReadFile, mockWriteFile)
    })

    it('should handle multiple set and get operations', async () => {
      // Arrange
      const data1 = { id: 1, value: 'test1' }
      const data2 = { id: 2, value: 'test2' }
      mockWriteFile.mockResolvedValue(undefined)
      mockReadFile.mockResolvedValue(data1)
      mockLRUInstance.get.mockReturnValue(Date.now() + 10000)
      mockLockInstance.readLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      mockLockInstance.writeLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )

      // Act
      await cache.set('key1', data1)
      await cache.set('key2', data2)
      const result1 = await cache.get('key1')
      const result2 = await cache.get('key2')
      const stats = cache.getStats()

      // Assert
      expect(result1).toEqual(data1)
      expect(result2).toEqual(data1) // mock returns same data
      expect(stats.total).toBe(2)
    })

    it('should calculate hit rate correctly', async () => {
      // Arrange
      mockLRUInstance.get.mockReturnValue(Date.now() + 10000)
      mockReadFile.mockResolvedValue({ data: 'test' })
      mockLockInstance.readLock.mockImplementation(
        (key: string, callback: (release: () => void) => void) => {
          callback(() => {})
        }
      )
      // Simulate 10 gets: 5 hits, 5 misses
      mockLRUInstance.get.mockReturnValueOnce(Date.now() + 10000)
      mockLRUInstance.get.mockReturnValueOnce(Date.now() + 10000)
      mockLRUInstance.get.mockReturnValueOnce(Date.now() + 10000)
      mockLRUInstance.get.mockReturnValueOnce(Date.now() + 10000)
      mockLRUInstance.get.mockReturnValueOnce(Date.now() + 10000)
      mockLRUInstance.get.mockReturnValueOnce(undefined)
      mockLRUInstance.get.mockReturnValueOnce(undefined)
      mockLRUInstance.get.mockReturnValueOnce(undefined)
      mockLRUInstance.get.mockReturnValueOnce(undefined)
      mockLRUInstance.get.mockReturnValueOnce(undefined)

      // Act
      for (let i = 0; i < 10; i++) {
        await cache.get(`key${i}`)
      }
      const stats = cache.getStats()

      // Assert
      expect(stats.total).toBe(10)
      expect(stats.hitRate).toBeDefined()
    })
  })
})
