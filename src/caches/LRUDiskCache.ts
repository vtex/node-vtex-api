import { CacheLayer } from './CacheLayer'
import { LRUDiskCacheOptions, LRUStats } from './typings'

import { outputJSON, readJSON, remove } from 'fs-extra'
import LRU from 'lru-cache'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

export class LRUDiskCache<V> implements CacheLayer<string, V>{

  private lock: ReadWriteLock
  private disposed: number
  private hits = 0
  private total = 0
  private lruStorage: LRU<string, number>

  constructor(private cachePath: string, options: LRUDiskCacheOptions, private readFile=readJSON, private writeFile=outputJSON) {
    this.hits = 0
    this.total = 0
    this.disposed = 0
    this.lock = new ReadWriteLock()

    const dispose = (key: string): void => {
      this.disposed += 1
      this.deleteFile(key)
    }

    const lruOptions = {
      ...options,
      dispose,
      noDisposeOnSet: true,
    }

    this.lruStorage = new LRU<string, number>(lruOptions)

  }

  public has = (key: string): boolean => this.lruStorage.has(key)

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

  public get = async (key: string): Promise<V | void>  => {
    const timeOfDeath = this.lruStorage.get(key)
    this.total += 1

    const pathKey = this.getPathKey(key)

    const data = await new Promise<V | undefined>(resolve => {
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
    if (timeOfDeath && timeOfDeath < Date.now()) {
      this.lruStorage.del(key)
    }

    return data
  }

  public set = async (key: string, value: V, maxAge?: number): Promise<boolean> => {
    let timeOfDeath = NaN
    if (maxAge) {
      timeOfDeath = maxAge + Date.now()
      this.lruStorage.set(key, timeOfDeath, maxAge)
    }
    else {
      this.lruStorage.set(key, NaN)
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

  private getPathKey = (key: string): string => {
    return join(this.cachePath, key)
  }

  private deleteFile = async (key: string): Promise<boolean> => {
    const pathKey = this.getPathKey(key)
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
