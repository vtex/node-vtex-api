import { CacheLayer } from './CacheLayer'
import { FetchResult } from './typings'

export class MemCached<K, V> implements CacheLayer<K, V> {
  public get(key: K, fetcher?: () => Promise<FetchResult<V>>): void | V | Promise<void | V> {
    throw new Error("Method not implemented.");
  }

  public has(key: K): boolean | Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public set(key: K, value: V, maxAge?: number | void): boolean | Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public getStats?(name?: string) {
    throw new Error("Method not implemented.");
  }
}
