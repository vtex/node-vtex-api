export interface CacheLayer<K, V> {
  get (key: K, fetcher?: () => Promise<V>): Promise<V | void> | V | void,
  has (key: K): Promise<boolean> | boolean,
  set (key: K, value: V): Promise<boolean> | boolean,
  getStats? (name?: string): any,
}