import { LocalCacheOptions } from '../HttpClient'
import { FetchResult } from './typings'

export interface CacheLayer<K, V> {
  get (key: K, fetcher?: () => Promise<FetchResult<V>>, options?: LocalCacheOptions): Promise<V | void> | V | void,
  has (key: K, options?: LocalCacheOptions): Promise<boolean> | boolean,
  set (key: K, value: V, maxAge?: number | void, options?: LocalCacheOptions): Promise<boolean> | boolean,
  getStats? (name?: string): any,
}
