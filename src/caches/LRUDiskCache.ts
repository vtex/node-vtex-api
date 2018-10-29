import { CacheLayer } from './CacheLayer'
import { DiskItem, LRUDiskCacheOptions, LRUStats } from './typings'

import { outputJSON, readJSON, remove } from 'fs-extra'
import * as LRU from 'lru-cache'
import { join } from 'path'


export class LRUDiskCache<V> implements CacheLayer<string, V>{

  private disposed: number
  private hits = 0
  private total = 0
  private lruStorage: LRU.Cache<string, boolean>
  private metaStorage: Map<string, DiskItem<V>>
  private keyToBeDeleted: string

  constructor(private cachePath: string, options: LRUDiskCacheOptions, private readFile=readJSON, private writeFile=outputJSON) {
    this.hits = 0
    this.total = 0
    this.disposed = 0
    this.keyToBeDeleted = ''
    this.metaStorage = new Map<string, DiskItem<V>>()

    const dispose = (key: string, diskItem: boolean): void => {
      this.keyToBeDeleted = key
      this.disposed += 1
    }

    this.lruStorage = new LRU({
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
    if (!this.lruStorage.get(key)) {
      this.total += 1
      return undefined
    }
    const diskItem = this.metaStorage.get(key) as DiskItem<V>
    if (diskItem.readable) {
      this.addReader(key, diskItem)
      this.total += 1
    }
    else {
      return new Promise<V | void>( resolve => {
        this.addGetResolver(key, resolve)
        return this.get(key)
      })
    }
    const pathKey = this.getPathKey(key)
    try {
      const data = await this.readFile(pathKey)
      this.hits += 1
      this.removeReader(key, diskItem)
      const updatedDiskItem = this.metaStorage.get(key) as DiskItem<V>
      if (diskItem.timeOfDeath < Date.now() && updatedDiskItem.deletable) {
        this.lruStorage.del(key)
        this.deleteFile(key)
      }
      return data
    } catch (e) {
      return undefined
    }
  }

  public set = async (key: string, value: V, maxAge?: number): Promise<boolean> => {
    if (this.metaStorage.has(key)) {
      const diskItem = this.metaStorage.get(key) as DiskItem<V>
      if (!diskItem.deletable) {
        return new Promise<boolean>(resolve => {
          this.addDeleteResolver(key, resolve)
          return this.set(key, value, maxAge)
        })
      }
    }
    const newDiskItem: DiskItem<V> = {
      deletable: false,
      deleteResolvers: [],
      getResolvers: [],
      readable: false,
      readingCount: 0,
      timeOfDeath: maxAge
        ? maxAge + Date.now()
        : NaN,
    }
    this.lruStorage.set(key, true, maxAge)
    this.metaStorage.set(key, newDiskItem)
    let promise = Promise.resolve(true)
    if (this.keyToBeDeleted && this.keyToBeDeleted !== key) {
      const diskItem = this.metaStorage.get(this.keyToBeDeleted) as DiskItem<V>
      if (!diskItem.deletable) {
        promise = new Promise<boolean>(resolve => {
          this.addDeleteResolver(key, resolve)
          this.deleteFile(this.keyToBeDeleted)
          return true
        })
      }
      else {
        this.deleteFile(this.keyToBeDeleted)
      }
    }
    else {
      this.keyToBeDeleted = ''
    }
    const pathKey = this.getPathKey(key)
    await this.writeFile(pathKey, value)
    this.setDefaultStatus(key, newDiskItem)
    return promise
  }

  private getPathKey = (key: string) => {
    return join(this.cachePath, key)
  }

  private deleteFile = (key: string) => {
    this.keyToBeDeleted = ''
    if (key) {
      this.metaStorage.delete(key)
      const pathKey = this.getPathKey(key)
      remove(pathKey)
      .catch(err => {
        console.error(err)
      })
    }
  }

  private addDeleteResolver = (key: string, resolve: () => void) => {
    if (!this.metaStorage.has(key)) {
      return
    }
    const diskItem = this.metaStorage.get(key) as DiskItem<V>
    diskItem.deleteResolvers.push(resolve)
    this.metaStorage.set(key, diskItem)
  }

  private addGetResolver = (key: string, resolve: () => void) => {
    if (!this.metaStorage.has(key)) {
      return
    }
    const diskItem = this.metaStorage.get(key) as DiskItem<V>
    diskItem.getResolvers.push(resolve)
    this.metaStorage.set(key, diskItem)
  }

  private addReader = (key: string, diskItem: DiskItem<V>) => {
    diskItem.deletable = false
    diskItem.readingCount += 1
    this.metaStorage.set(key, diskItem)
  }

  private removeReader = (key: string, diskItem: DiskItem<V>) => {
    diskItem.readingCount -= 1
    if (diskItem.readingCount === 0){
      diskItem.deletable = true
      diskItem.deleteResolvers.forEach(resolve => resolve())
      diskItem.deleteResolvers = []
    }
    this.metaStorage.set(key, diskItem)
  }

  private setDefaultStatus = (key: string, diskItem: DiskItem<V>) => {
    diskItem.readable = true
    diskItem.deletable = true
    if (diskItem.getResolvers !== []) {
      diskItem.getResolvers.forEach(resolve => resolve())
      diskItem.getResolvers = []
    }
    else {
      diskItem.deleteResolvers.forEach(resolve => resolve())
      diskItem.deleteResolvers = []
    }
    this.metaStorage.set(key, diskItem)
  }
}
