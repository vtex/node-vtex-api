import { CacheLayer } from './CacheLayer'
import { LRUDiskCacheOptions, LRUStats } from './typings'

import { outputJSON, readdirSync, readJSON, remove } from 'fs-extra'
import * as LRU from 'lru-cache'
import { join } from 'path'

export class LRUDiskCache<V> implements CacheLayer<string, V>{
    
  private disposed: number
  private keySeparator = `maxAge*&*`
  private hits = 0
  private total = 0
  private lruStorage: LRU.Cache<string, number>

  constructor(private cachePath: string, options: LRUDiskCacheOptions, private readFile=readJSON, private writeFile=outputJSON) {
    this.hits = 0
    this.total = 0
    this.disposed = 0

    const dispose = (key: string, timeOfDeath: number): void => {
      const pathKey = this.getPathKey(key, timeOfDeath)
      remove(pathKey)
      .catch(err => {
        console.error(err)
      })
      this.disposed += 1
    }

    this.lruStorage = new LRU({
      ...options,
      dispose,
    })

    const filesInDisk = readdirSync(cachePath)
    filesInDisk.forEach(keyPath => {
      const [key, timeOfDeathString] = keyPath.split(this.keySeparator)
      const timeOfDeath = parseInt(timeOfDeathString, 10)
      const maxAge = timeOfDeath - Date.now()
      this.lruStorage.set(key, timeOfDeath, maxAge)
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
    this.total += 1
    const maxAge = this.lruStorage.get(key)
    if (maxAge === undefined) {
      return undefined
    }
    const pathKey = this.getPathKey(key, maxAge)
    try {
      const data = await this.readFile(pathKey)
      this.hits += 1
      return data
    } catch (e) {
      return undefined
    }
  }

  public set = async (key: string, value: V, maxAge?: number) => {
    let timeOfDeath = NaN
    if (maxAge) {
      timeOfDeath = maxAge + Date.now()
      this.lruStorage.set(key, timeOfDeath, maxAge)
    }
    else {
      this.lruStorage.set(key, NaN)
    }
    const pathKey = this.getPathKey(key, timeOfDeath)
    await this.writeFile(pathKey, value)
    return true
  }

  private getPathKey = (key: string, timeOfDeath?: number) => {
    if (timeOfDeath) {
      return join(this.cachePath, `${key}${this.keySeparator}${timeOfDeath}`)
    }
    else {
      return join(this.cachePath, `${key}`)
    }
  }
}
