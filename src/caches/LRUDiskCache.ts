import { CacheLayer } from './CacheLayer'
import { LRUDiskCacheOptions, LRUStats } from './typings'

import { outputJSON, readJSON, remove } from 'fs-extra'
import * as LRU from 'lru-cache'
import { join } from 'path'
import * as ReadWriteLock from 'rwlock'


export class LRUDiskCache<V> implements CacheLayer<string, V>{
  
  private lock: ReadWriteLock
  private disposed: number
  private hits = 0
  private total = 0
  private lruStorage: LRU.Cache<string, number>
  private keyToBeDeleted: string

  constructor(private cachePath: string, options: LRUDiskCacheOptions, private readFile=readJSON, private writeFile=outputJSON) {
    this.hits = 0
    this.total = 0
    this.disposed = 0
    this.keyToBeDeleted = ''
    this.lock = new ReadWriteLock()

    const dispose = (key: string, timeOfDeath: number): void => {
      this.keyToBeDeleted = key
      this.disposed += 1
    }

    this.lruStorage = new LRU<string, number>({
      ...options,
      dispose,
    })

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
    if (timeOfDeath === undefined) {
      this.total += 1

      // if it is an outdated file when stale=false
      if (this.keyToBeDeleted) {
        await this.deleteFile(key)
      }
      return undefined
    }

    const pathKey = this.getPathKey(key)
    try {
      const data = await new Promise<V>(resolve => {
        this.lock.readLock(key, async (release: () => void) => {
          const fileData = await this.readFile(pathKey)
          release()
          resolve(fileData)
        })
      })
  
      this.total += 1
      this.hits += 1
  
      // if it is an outdated file when stale=true
      if (!this.lruStorage.has(key)) {
        await this.deleteFile(key)
      }

      return data
    } catch (e) {
      return undefined
    }
  }

  public set = async (key: string, value: V, maxAge?: number): Promise<boolean> => {

    await new Promise<[void, void]>(resolve => {
      
      this.lock.writeLock(key, async (release: () => void) => {
  
        let timeOfDeath = NaN
        if (maxAge) {
          timeOfDeath = maxAge + Date.now()
          this.lruStorage.set(key, timeOfDeath, maxAge)
        }
        else {
          this.lruStorage.set(key, NaN)
        }

        let deletePromise: void
        if (this.keyToBeDeleted && this.keyToBeDeleted !== key) {
          deletePromise = await this.deleteFile(this.keyToBeDeleted)
        }

        const pathKey = this.getPathKey(key)
        const writePromise = await this.writeFile(pathKey, value)
  
        resolve(Promise.all([deletePromise, writePromise]))

        release()
      })
    })

    return true
  }

  private getPathKey = (key: string): string => {
    return join(this.cachePath, key)
  }

  private deleteFile = async (key: string): Promise<void> => {

    return new Promise<void>(resolve => {
      this.lock.writeLock(key, async (release: () => void) => {
        this.keyToBeDeleted = ''
        const pathKey = this.getPathKey(key)
        const removePromise = await remove(pathKey)
        release()
        resolve(removePromise)
      })
    }) 
  }
}
