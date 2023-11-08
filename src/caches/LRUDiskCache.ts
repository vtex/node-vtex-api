import { CacheLayer } from './CacheLayer'
import { LRUDiskCacheOptions, LRUStats } from './typings'

import { outputJSON, readJSON, remove } from 'fs-extra'
import LRU from 'lru-cache'
import { join } from 'path'
import ReadWriteLock from 'rwlock'
import { LocalCacheOptions } from '../HttpClient'

export type LRUData = Record<string, unknown> & { timeOfDeath: number }

export class LRUDiskCache<V> implements CacheLayer<string, V>{

  protected disposed: number
  protected hits = 0
  protected total = 0
  private lock: ReadWriteLock
  private lruStorage: LRU<string, LRUData>
  private keyToBeDeleted: string

  constructor(private cachePath: string, options: LRUDiskCacheOptions, private readFile=readJSON, private writeFile=outputJSON) {
    this.hits = 0
    this.total = 0
    this.disposed = 0
    this.keyToBeDeleted = ''
    this.lock = new ReadWriteLock()

    const dispose = (key: string): void => {
      this.keyToBeDeleted = key
      this.disposed += 1
    }

    const lruOptions = {
      ...options,
      dispose,
      noDisposeOnSet: true,
    }

    this.lruStorage = new LRU<string, LRUData>(lruOptions)

  }

  public has (key: string): boolean {
    return this.lruStorage.has(key)
  } 

  public getStats = (name='disk-lru-cache'): LRUStats => {
    const stats = {
      disposedItems: this.disposed,
      hitRate: this.total > 0 ? this.hits / this.total : undefined,
      hits: this.hits,
      itemCount: this.lruStorage.itemCount,
      length: this.lruStorage.length,
      max: this.lruStorage.max,
      name,
      total: this.total,
    }
    this.hits = 0
    this.total = 0
    this.disposed = 0
    return stats
  }

  public async get (key: string): Promise<V | void> {
    const lruData = this.lruStorage.get(key)
    this.total += 1
    if (lruData === undefined) {

      // if it is an outdated file when stale=false
      if (this.keyToBeDeleted) {
        await this.deleteFile(key)
      }
      return undefined
    }

    const pathKey = this.getPathKey(key)

    const data = await new Promise<V>(resolve => {
      this.lock.readLock(key, async (release: () => void) => {
        try {
          const fileData = await this.readFile(pathKey)
          release()
          this.hits += 1
          resolve(fileData)
        } catch (e) {
          release()
          resolve(undefined)
        }
      })
    })

    // if it is an outdated file when stale=true
    if (lruData.timeOfDeath < Date.now()) {
      this.lruStorage.del(key)
      await this.deleteFile(key)
    }

    return data
  }

  public async set (key: string, value: V, maxAge?: number, localCacheOptions?: LocalCacheOptions): Promise<boolean> {
    const timeOfDeath = maxAge ? maxAge + Date.now() : NaN
    const lruData = this.buildLRUData(timeOfDeath, localCacheOptions)
    this.lruStorage.set(key, lruData, maxAge ? maxAge : undefined)

    if (this.keyToBeDeleted && this.keyToBeDeleted !== key) {
      await this.deleteFile(this.keyToBeDeleted)
    }

    const pathKey = this.getPathKey(key)
    const failure = await new Promise<void | boolean>(resolve => {
      this.lock.writeLock(key, async (release: () => void) => {
        try {
          const writePromise = await this.writeFile(pathKey, value)
          release()
          resolve(writePromise)
        } catch (e) {
          release()
          resolve(true)
        }
      })
    })

    return !failure
  }

  /**
   * Builds the data object that will be stored at the LRU memory storage.
   * Subclasses that need to store more than just the time of death should
   * override this.
   */
  protected buildLRUData(timeOfDeath: number, localCacheOptions?: LocalCacheOptions): LRUData {
    return { timeOfDeath }
  }

  protected getLRU() {
    return this.lruStorage
  }

  private getPathKey = (key: string): string => {
    return join(this.cachePath, key)
  }

  private deleteFile = async (key: string): Promise<boolean> => {
    const pathKey = this.getPathKey(key)
    this.keyToBeDeleted = ''
    const failure = new Promise<void | boolean>(resolve => {
      this.lock.writeLock(key, async (release: () => void) => {
        try {
          const removePromise = await remove(pathKey)
          release()
          resolve(removePromise)
        } catch (e) {
          release()
          resolve(true)
        }
      })
    })
    return !failure
  }
}
