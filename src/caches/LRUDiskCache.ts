import { CacheLayer } from './CacheLayer'
import { CumulativeStats, LRUDiskCacheOptions, LRUStats } from './typings'
import { WindowedCounters } from './WindowedCounters'

import { outputJSON, readJSON, remove } from 'fs-extra'
import LRU from 'lru-cache'
import { join } from 'path'
import ReadWriteLock from 'rwlock'

export class LRUDiskCache<V> implements CacheLayer<string, V>{

  private lock: ReadWriteLock
  private readonly counters: WindowedCounters
  private lruStorage: LRU<string, number>
  private keyToBeDeleted: string

  constructor(private cachePath: string, options: LRUDiskCacheOptions, private readFile=readJSON, private writeFile=outputJSON) {
    this.counters = new WindowedCounters()
    this.keyToBeDeleted = ''
    this.lock = new ReadWriteLock()

    const dispose = (key: string): void => {
      this.keyToBeDeleted = key
      this.counters.countDisposed()
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
    const { disposed, hits, total } = this.counters.windowed()
    return {
      disposedItems: disposed,
      hitRate: total > 0 ? hits / total : undefined,
      hits,
      itemCount: this.lruStorage.itemCount,
      length: this.lruStorage.length,
      max: this.lruStorage.max,
      name,
      total,
    }
  }

  public getCumulativeStats = (): CumulativeStats => {
    const { disposed, hits, total } = this.counters.cumulative()
    return {
      disposedItems: disposed,
      hits,
      itemCount: this.lruStorage.itemCount,
      length: this.lruStorage.length,
      max: this.lruStorage.max,
      total,
    }
  }

  public get = async (key: string): Promise<V | void>  => {
    const timeOfDeath = this.lruStorage.get(key)
    this.counters.countRead()
    if (timeOfDeath === undefined) {

      // if it is an outdated file when stale=false
      if (this.keyToBeDeleted) {
        await this.deleteFile(key)
      }
      return undefined
    }

    const pathKey = this.getPathKey(key)

    const data = await new Promise<V | undefined>(resolve => {
      this.lock.readLock(key, async (release: () => void) => {
        try {
          const fileData = await this.readFile(pathKey)
          release()
          this.counters.countHit()
          resolve(fileData)
        } catch (e) {
          release()
          resolve(null as unknown as V)
        }
      })
    })

    // if it is an outdated file when stale=true
    if (timeOfDeath < Date.now()) {
      this.lruStorage.del(key)
      await this.deleteFile(key)
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
