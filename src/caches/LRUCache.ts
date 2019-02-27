import LRU from 'lru-cache'
import { CacheLayer } from './CacheLayer'
import { MultilayeredCache } from './MultilayeredCache'
import { FetchResult, LRUStats } from './typings'

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

  public getOrSet = async (key: K, fetcher?: () => Promise<FetchResult<V>>): Promise<V | void> => this.multilayer.get(key, fetcher)

  public set = (key: K, value: V, maxAge?: number): boolean => this.storage.set(key, value, maxAge)

  public has = (key: K): boolean => this.storage.has(key)

  public getStats = (name='lru-cache'): LRUStats => {
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
