import { CumulativeStats } from './typings'

/**
 * Process-wide registry of caches that asked for observable metrics at construction
 * time, through the `metricName` option of the cache classes. DiagnosticsMetrics
 * subscribes to it and routes every entry through trackCache(), so an app declares
 * the name once, where the cache is defined, instead of registering each instance
 * against the global facade by hand.
 *
 * The registry lives on globalThis (Symbol.for, not module scope) so a cache built
 * by one copy of @vtex/api is still seen by the DiagnosticsMetrics of another, the
 * same way global.diagnosticsMetrics itself is shared.
 *
 * Registration is order-independent: a cache constructed before the metrics client
 * exists (module-level caches load before startApp() creates the global) sits in the
 * registry until a DiagnosticsMetrics subscribes and drains it.
 */

// Structural copy of the TrackedCache contract from metrics/DiagnosticsMetrics.ts,
// kept local so the caches layer never imports the metrics layer at runtime.
interface TrackableCache {
  getCumulativeStats(): CumulativeStats
}

type CacheTrackingSubscriber = (name: string, cache: TrackableCache) => void

interface CacheTrackingRegistry {
  entries: Map<string, TrackableCache>
  instances: WeakMap<TrackableCache, string>
  subscribers: Set<CacheTrackingSubscriber>
}

const REGISTRY_KEY = Symbol.for('vtex.api.cacheTrackingRegistry')

const freshRegistry = (): CacheTrackingRegistry => ({
  entries: new Map(),
  instances: new WeakMap(),
  subscribers: new Set(),
})

const registry = (): CacheTrackingRegistry => {
  const store = globalThis as { [REGISTRY_KEY]?: CacheTrackingRegistry }
  if (!store[REGISTRY_KEY]) {
    store[REGISTRY_KEY] = freshRegistry()
  }
  return store[REGISTRY_KEY]!
}

const notify = (subscriber: CacheTrackingSubscriber, name: string, cache: TrackableCache): void => {
  try {
    subscriber(name, cache)
  } catch (error) {
    console.error('cacheTrackingRegistry: a subscriber threw while registering cache', name, error)
  }
}

/**
 * Registers a cache for observable metrics under `name`. Called by the cache class
 * constructors when built with the `metricName` option.
 *
 * One name per instance: an instance already registered keeps its first name, so a
 * cache registered twice (constructor option plus a leftover manual trackCache call
 * under another name) cannot publish the same counters as two different series. One
 * instance per name: a name already taken moves to the new instance, matching
 * trackCache()'s replace semantics.
 */
export const registerCacheForTracking = (name: string, cache: TrackableCache): void => {
  const { entries, instances, subscribers } = registry()

  const existingName = instances.get(cache)
  if (existingName !== undefined) {
    if (existingName !== name) {
      console.warn(
        `cacheTrackingRegistry: this cache instance is already registered as '${existingName}'; ` +
        `ignoring the registration as '${name}'. A double registration would count the same counters twice.`
      )
    }
    return
  }

  const previous = entries.get(name)
  if (previous !== undefined) {
    console.warn(
      `cacheTrackingRegistry: '${name}' was already registered to another cache instance; ` +
      `the name now points at the new one. Pick distinct metricName values per cache.`
    )
    instances.delete(previous)
  }

  entries.set(name, cache)
  instances.set(cache, name)

  for (const subscriber of subscribers) {
    notify(subscriber, name, cache)
  }
}

/**
 * Subscribes to registrations: drains every entry registered so far, then reports
 * each future one. Returns the unsubscribe function.
 */
export const subscribeToCacheTracking = (subscriber: CacheTrackingSubscriber): (() => void) => {
  const { entries, subscribers } = registry()

  subscribers.add(subscriber)
  for (const [name, cache] of entries) {
    notify(subscriber, name, cache)
  }

  return () => {
    subscribers.delete(subscriber)
  }
}

/**
 * Test support: installs a fresh registry, dropping every entry and subscriber.
 * DiagnosticsMetrics subscribes in its constructor, so reset between tests and only
 * then construct the instance under test.
 */
export const resetCacheTrackingRegistryForTests = (): void => {
  (globalThis as { [REGISTRY_KEY]?: CacheTrackingRegistry })[REGISTRY_KEY] = freshRegistry()
}
