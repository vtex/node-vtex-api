import { FetchResult } from './typings'

export interface CacheLayer<K, V> {
  get (key: K, fetcher?: () => Promise<FetchResult<V>>): Promise<V | void> | V | void,
  has (key: K): Promise<boolean> | boolean,
  set (key: K, value: V, maxAge?: number | void): Promise<boolean> | boolean,
  delete? (key: K): Promise<void> | void,
  getStats? (name?: string): any,
}
