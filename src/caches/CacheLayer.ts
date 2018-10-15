export interface CacheLayer<K, V> {
  get (key: K, fetcher?: () => Promise<V>): Promise<V | void>,
  has (key: K): Promise<boolean>,
  set (key: K, value: V): Promise<boolean>,
  getStats? (name?: string): any,
}