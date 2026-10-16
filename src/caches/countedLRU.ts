import LRU from 'lru-cache'
import { CumulativeStats, LRUStats } from './typings'
import { WindowedCounters } from './WindowedCounters'

/**
 * The pieces LRUCache and LRUDiskCache build identically over an lru-cache storage:
 * eviction wired into the counters, and the windowed and cumulative stats reads.
 * Shared so the two classes cannot drift apart — a fix to the dispose wiring or to
 * one stats shape used to have to land twice. DiskCache and MultilayeredCache are
 * not here on purpose: the only state they share with these is the WindowedCounters
 * instance itself, which is already the shared piece.
 */

/**
 * Builds the storage with eviction counted the way both caches report it:
 * noDisposeOnSet so an overwrite is not an eviction, dispose feeding the counter.
 * onDispose runs first, for a caller that reacts to the evicted key itself
 * (LRUDiskCache marks the file for deletion).
 */
export const createCountedLRU = <K, V>(
  counters: WindowedCounters,
  options: LRU.Options<K, V>,
  onDispose?: (key: K) => void
): LRU<K, V> =>
  new LRU({
    ...options,
    dispose: (key: K) => {
      if (onDispose) {
        onDispose(key)
      }
      counters.countDisposed()
    },
    noDisposeOnSet: true,
  })

/**
 * The legacy per-window read: the delta since the previous windowed() call, over
 * the storage's current shape.
 */
export const windowedLRUStats = (counters: WindowedCounters, storage: LRU<any, any>, name: string): LRUStats => {
  const { disposed, hits, total } = counters.windowed()
  return {
    disposedItems: disposed,
    hitRate: total > 0 ? hits / total : undefined,
    hits,
    itemCount: storage.itemCount,
    length: storage.length,
    max: storage.max,
    name,
    total,
  }
}

/**
 * The observable read: process-lifetime totals, side-effect free.
 */
export const cumulativeLRUStats = (counters: WindowedCounters, storage: LRU<any, any>): CumulativeStats => {
  const { disposed, hits, misses, total } = counters.cumulative()
  return {
    disposedItems: disposed,
    hits,
    itemCount: storage.itemCount,
    length: storage.length,
    max: storage.max,
    misses,
    total,
  }
}
