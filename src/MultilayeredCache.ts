import { map, slice } from 'ramda'

export class MultilayeredCache <K, V> implements CacheLayer<K, V>{

  private hits = 0
  private total = 0

  constructor (private caches: Array<CacheLayer<K, V>>) {}

  public get = async (key: K, fetcher?: () => V): Promise<V | void> => {
    let value: V | void
    let successIndex = await this.findIndex(async (cache: CacheLayer<K, V>) => {
      const [getValue, hasKey] = await Promise.all([cache.get(key), cache.has(key)])
      value = getValue
      return hasKey
    }, this.caches)
    if (successIndex === -1) {
      if (fetcher) {
        value = fetcher()
      } else {
        return undefined
      }
      successIndex = Infinity
    }
    const failedCaches = slice(0, successIndex, this.caches)
    failedCaches.forEach(cache => cache.set(key, value as V))
    return value
  }

  public set = async (key: K, value: V) => {
    this.caches.forEach(async (cache: CacheLayer<K, V>) => {
      await cache.set(key, value)
    })
  }

  public has = async (key: K): Promise<boolean> => {
    let hasInAtLeastOneCache = false
    this.caches.forEach(async (cache: CacheLayer<K, V>) => {
      hasInAtLeastOneCache = hasInAtLeastOneCache || await cache.has(key)
    })
    return hasInAtLeastOneCache
  }

  public getStats = async (): Promise<MultilayerStats> => {
    const layersStats = Promise.all(map(
      (cache: CacheLayer<K, V>) => cache.getStats
        ? cache.getStats()
        : undefined
      , this.caches))
    const multilayerStats = {
      hitRate: this.total > 0 ? this.hits / this.total : undefined,
      hits: this.hits,
      layers: layersStats,
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

export interface CacheLayer<K, V> {
  get (key: K, fetcher?: () => V): Promise<V | void>,
  has (key: K): Promise<boolean>,
  set (key: K, value: V): void,
  getStats? (): any,
}

export interface MultilayerStats {
  hitRate: number | undefined,
  hits: number,
  total: number,
  layers: any
}
