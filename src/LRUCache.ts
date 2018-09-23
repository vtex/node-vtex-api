import * as LRU from 'lru-cache'

import {GetStats} from './MetricsAccumulator'

export class LRUCache <K, V> implements GetStats {
  private storage: LRU.Cache<K, V>
  private hits: number
  private total: number
  private disposed: number

  constructor (options: LRU.Options) {
    this.hits = 0
    this.total = 0
    this.disposed = 0
    this.storage = new LRU({
      ...options,
      dispose: () => this.disposed += 1,
    })
  }

  public get = (key: K): V | void => {
    const value = this.storage.get(key)
    if (this.storage.has(key)) {
      this.hits += 1
    }
    this.total += 1
    return value
  }

  public set = (key: K, value: V): boolean => this.storage.set(key, value)

  public has = (key: K): boolean => this.storage.has(key)

  public getStats = (): Stats => {
    const stats = {
      disposedItems: this.disposed,
      hitRate: this.total > 0 ? this.hits / this.total : undefined,
      hits: this.hits,
      itemCount: this.storage.itemCount,
      length: this.storage.length,
      max: this.storage.max,
      total: this.total,
    }
    this.hits = 0
    this.total = 0
    this.disposed = 0
    return stats
  }
}

// tslint:disable-next-line:interface-over-type-literal
export type Stats = {
  itemCount: number,
  length: number,
  disposedItems: number,
  hitRate: number | undefined,
  hits: number,
  max: number,
  total: number,
}
