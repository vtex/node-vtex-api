import { CacheLayer } from './CacheLayer'
import { createCountedLRU, cumulativeLRUStats, windowedLRUStats } from './countedLRU'
import { registerCacheForTracking } from './trackingRegistry'
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
    const { metricName, ...storageOptions } = options

    this.counters = new WindowedCounters()
    this.keyToBeDeleted = ''
    this.lock = new ReadWriteLock()

    this.lruStorage = createCountedLRU(this.counters, storageOptions, key => {
      this.keyToBeDeleted = key
    })

    if (metricName) {
      registerCacheForTracking(metricName, this)
    }
  }

  public has = (key: string): boolean => this.lruStorage.has(key)

  public getStats = (name='disk-lru-cache'): LRUStats => windowedLRUStats(this.counters, this.lruStorage, name)

  public getCumulativeStats = (): CumulativeStats => cumulativeLRUStats(this.counters, this.lruStorage)

  public get = async (key: string): Promise<V | void>  => {
    const timeOfDeath = this.lruStorage.get(key)
    this.counters.countRead()
    if (timeOfDeath === undefined) {
      this.counters.countMiss()

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
        } catch {
          release()
          this.counters.countMiss() // a missing or unreadable file is a miss
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
        } catch {
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
        } catch {
          release()
          resolve(true)
        }
      })
    })
    return !failure
  }
}
