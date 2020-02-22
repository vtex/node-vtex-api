export interface FetchResult<V> {
  value: V
  maxAge?: number
}

export interface DiskStats {
  hits: number
  total: number
  name: string
}

export interface LRUStats {
  itemCount: number
  length: number
  disposedItems: number
  hitRate: number | undefined
  hits: number
  max: number
  name: string
  total: number
}

export interface MultilayerStats {
  hitRate: number | undefined
  hits: number
  total: number
  name: string
}

export interface LRUDiskCacheOptions {
  /**
   * The maximum size of the cache, checked by applying the length
   * function to all values in the cache. Not setting this is kind of silly,
   * since that's the whole purpose of this lib, but it defaults to `Infinity`.
   */
  max?: number
  /**
   * Maximum age in ms. Items are not pro-actively pruned out as they age,
   * but if you try to get an item that is too old, it'll drop it and return
   * undefined instead of giving it to you.
   */
  maxAge?: number
  /**
   * By default, if you set a `maxAge`, it'll only actually pull stale items
   * out of the cache when you `get(key)`. (That is, it's not pre-emptively
   * doing a `setTimeout` or anything.) If you set `stale:true`, it'll return
   * the stale value before deleting it. If you don't set this, then it'll
   * return `undefined` when you try to get a stale entry,
   * as if it had already been deleted.
   */
  stale?: boolean
}
