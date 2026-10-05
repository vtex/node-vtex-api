import { any, map, slice } from 'ramda'
import { CacheLayer } from './CacheLayer'
import { CumulativeStats, FetchResult, MultilayerStats } from './typings'
import { WindowedCounters } from './WindowedCounters'

export class MultilayeredCache <K, V> implements CacheLayer<K, V>{

  private readonly counters = new WindowedCounters()

  constructor (private caches: Array<CacheLayer<K, V>>) {}

  public get = async (key: K, fetcher?: () => Promise<FetchResult<V>>): Promise<V | void> => {
    let value: V | void = undefined
    let maxAge: number | void
    let successIndex = await this.findIndex(async (cache: CacheLayer<K, V>) => {
      const [getValue, hasKey] = await Promise.all([cache.get(key), cache.has(key)])
      value = getValue
      return hasKey
    }, this.caches)
    if (successIndex === -1) {
      if (fetcher) {
        const fetched = await fetcher()
        value = fetched.value
        maxAge = fetched.maxAge
      } else {
        return undefined
      }
      successIndex = Infinity
    }
    const failedCaches = slice(0, successIndex, this.caches)

    const [firstPromise] = map(cache => cache.set(key, value as V, maxAge), failedCaches)
    await firstPromise
    return value
  }

  public set = async (key: K, value: V, maxAge?: number): Promise<boolean> => {
    const isSet = await Promise.all(map(cache => cache.set(key, value, maxAge), this.caches))
    return any(item => item, isSet)
  }

  public has = async (key: K): Promise<boolean> => {
    const hasList = await Promise.all(map(cache => cache.has(key), this.caches))
    return any(item => item, hasList)
  }

  public getStats = (name='multilayred-cache'): MultilayerStats => {
    const { hits, total } = this.counters.windowed()
    return {
      hitRate: total > 0 ? hits / total : undefined,
      hits,
      name,
      total,
    }
  }

  public getCumulativeStats = (): CumulativeStats => {
    const { hits, total } = this.counters.cumulative()
    return { hits, total }
  }

  private findIndex = async <T> (func: (item: T) => Promise<boolean>, array: T[]): Promise<number> => {
    this.counters.countRead()
    for (let index = 0; index < array.length; index++) {
      const hasKey = await func(array[index])
      if (hasKey) {
        this.counters.countHit()
        return index
      }
    }
    return -1
  }

}
