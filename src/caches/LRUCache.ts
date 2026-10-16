import LRU from 'lru-cache'
import { CacheLayer } from './CacheLayer'
import { MultilayeredCache } from './MultilayeredCache'
import { registerCacheForTracking } from './trackingRegistry'
import { CumulativeStats, FetchResult, LRUCacheOptions, LRUStats } from './typings'
import { WindowedCounters } from './WindowedCounters'

export class LRUCache <K, V> implements CacheLayer<K, V>{
  private multilayer: MultilayeredCache<K, V>
  private storage: LRU<K, V>
  private readonly counters: WindowedCounters

  constructor (options: LRUCacheOptions<K, V>) {
    const { metricName, ...lruOptions } = options

    this.counters = new WindowedCounters()
    this.storage = new LRU({
      ...lruOptions,
      dispose: () => this.counters.countDisposed(),
      noDisposeOnSet: true,
    })
    // The internal multilayer gets no metricName: registering it would count the
    // getOrSet reads twice, once here and once there.
    this.multilayer = new MultilayeredCache([this])

    if (metricName) {
      registerCacheForTracking(metricName, this)
    }
  }

  public get = (key: K): V | void => {
    const value = this.storage.get(key)
    if (this.storage.has(key)) {
      this.counters.countHit()
    } else {
      this.counters.countMiss()
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
    const { disposed, hits, misses, total } = this.counters.cumulative()
    return {
      disposedItems: disposed,
      hits,
      itemCount: this.storage.itemCount,
      length: this.storage.length,
      max: this.storage.max,
      misses,
      total,
    }
  }
}
