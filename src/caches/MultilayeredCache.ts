import { any, map, slice } from 'ramda'
import { CacheLayer } from './CacheLayer'

export class MultilayeredCache <K, V> implements CacheLayer<K, V>{

  private hits = 0
  private total = 0

  constructor (private caches: Array<CacheLayer<K, V>>) {}

  public get = async (key: K, fetcher?: () => Promise<V>): Promise<V | void> => {
    let value: V | void
    let successIndex = await this.findIndex(async (cache: CacheLayer<K, V>) => {
      const [getValue, hasKey] = await Promise.all([cache.get(key), cache.has(key)])
      value = getValue
      return hasKey
    }, this.caches)
    if (successIndex === -1) {
      if (fetcher) {
        value = await fetcher()
      } else {
        return undefined
      }
      successIndex = Infinity
    }
    const failedCaches = slice(0, successIndex, this.caches)
    await Promise.all(map(cache => cache.set(key, value as V), failedCaches))
    return value
  }

  public set = async (key: K, value: V) => {
    const isSet = await Promise.all(map(cache => cache.set(key, value), this.caches))
    return any(item => item, isSet)
  }

  public has = async (key: K): Promise<boolean> => {
    const hasList = await Promise.all(map(cache => cache.has(key), this.caches))
    return any(item => item, hasList)
  }

  public getStats = (name='multilayred-cache'): MultilayerStats => {
    const layersStats = map(
      (cache: CacheLayer<K, V>) => cache.getStats
        ? cache.getStats()
        : undefined
      , this.caches)
    const multilayerStats = {
      hitRate: this.total > 0 ? this.hits / this.total : undefined,
      hits: this.hits,
      layers: layersStats,
      name,
      total: this.total,
    }
    this.resetCounters()
    return multilayerStats
  }

  private findIndex = async <T> (func: (item: T) => Promise<boolean>, array: T[]): Promise<number> => {
    this.total += 1
    for (let index = 0; index < array.length; index++) {
      const hasKey = await func(array[index])
      if (hasKey) {
        this.hits += 1
        return index
      }
    }
    return -1
  }

  private resetCounters () {
    this.hits = 0
    this.total = 0
  }
}

export interface MultilayerStats {
  hitRate: number | undefined,
  hits: number,
  total: number,
  layers: any,
  name: string,
}
