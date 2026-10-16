import LRU from 'lru-cache'
import { CacheLayer } from './CacheLayer'
import { resolveCacheTracking } from './cacheNaming'
import { createCountedLRU, cumulativeLRUStats, windowedLRUStats } from './countedLRU'
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
    this.storage = createCountedLRU(this.counters, lruOptions)
    // The internal multilayer opts out of tracking: its getOrSet reads are
    // already counted by this LRUCache, so registering it would count them twice.
    this.multilayer = new MultilayeredCache([this], { metricName: false })

    const tracking = resolveCacheTracking(metricName)
    if (tracking) {
      registerCacheForTracking(tracking.name, this, tracking.source)
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

  public getStats = (name='lru-cache'): LRUStats => windowedLRUStats(this.counters, this.storage, name)

  public getCumulativeStats = (): CumulativeStats => cumulativeLRUStats(this.counters, this.storage)
}
