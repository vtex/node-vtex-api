import LRU from 'lru-cache'
import { CacheLayer } from './CacheLayer'
import { MultilayeredCache } from './MultilayeredCache'
import { CumulativeStats, FetchResult, LRUStats } from './typings'
import { WindowedCounters } from './WindowedCounters'

export class LRUCache <K, V> implements CacheLayer<K, V>{
  private multilayer: MultilayeredCache<K, V>
  private storage: LRU<K, V>
  private readonly counters: WindowedCounters

  constructor (options: LRU.Options<K, V>) {
    this.counters = new WindowedCounters()
    this.storage = new LRU({
      ...options,
      dispose: () => this.counters.countDisposed(),
      noDisposeOnSet: true,
    })
    this.multilayer = new MultilayeredCache([this])
  }

  public get = (key: K): V | void => {
    const value = this.storage.get(key)
    if (this.storage.has(key)) {
      this.counters.countHit()
    }
    this.counters.countRead()
    return value
  }

  public getOrSet = async (key: K, fetcher?: () => Promise<FetchResult<V>>): Promise<V | void> => this.multilayer.get(key, fetcher)

  public set = (key: K, value: V, maxAge?: number): boolean => this.storage.set(key, value, maxAge)

  public has = (key: K): boolean => this.storage.has(key)

  public getStats = (name='lru-cache'): LRUStats => {
    const { disposed, hits, total } = this.counters.windowed()
    return {
      disposedItems: disposed,
      hitRate: total > 0 ? hits / total : undefined,
      hits,
      itemCount: this.storage.itemCount,
      length: this.storage.length,
      max: this.storage.max,
      name,
      total,
    }
  }

  public getCumulativeStats = (): CumulativeStats => {
    const { disposed, hits, total } = this.counters.cumulative()
    return {
      disposedItems: disposed,
      hits,
      itemCount: this.storage.itemCount,
      length: this.storage.length,
      max: this.storage.max,
      total,
    }
  }
}
