import * as LRU from 'lru-cache'
import { CacheLayer } from './CacheLayer'
import { MultilayeredCache } from './MultilayeredCache'

export class LRUCache <K, V> implements CacheLayer<K, V>{
  private multilayer: MultilayeredCache<K, V>
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
    this.multilayer = new MultilayeredCache([this])
  }

  public get = (key: K): V | void => {
    const value = this.storage.get(key)
    if (this.storage.has(key)) {
      this.hits += 1
    }
    this.total += 1
    return value
  }

  public getOrSet = async (key: K, fetcher?: () => Promise<V>): Promise<V | void> => this.multilayer.get(key, fetcher)

  public set = (key: K, value: V): boolean => this.storage.set(key, value)

  public has = (key: K): boolean => this.storage.has(key)

  public getStats = (name='lru-cache-sync'): Stats => {
    const stats = {
      disposedItems: this.disposed,
      hitRate: this.total > 0 ? this.hits / this.total : undefined,
      hits: this.hits,
      itemCount: this.storage.itemCount,
      length: this.storage.length,
      max: this.storage.max,
      name,
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
  name: string,
  total: number,
}
