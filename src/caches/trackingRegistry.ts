import { CacheNameSource, outranks } from './cacheNaming'
import { CumulativeStats } from './typings'

/**
 * Process-wide registry of caches registered for observable metrics. A cache
 * arrives here with a name and the origin of that name (see cacheNaming.ts):
 * the metricName constructor option, the HttpClient it serves as memoryCache,
 * or a callsite-derived fallback. DiagnosticsMetrics subscribes to it and
 * routes every event through trackCache(), so an app never registers its own
 * caches by hand.
 *
 * The registry lives on globalThis (Symbol.for, not module scope) so a cache
 * built by one copy of @vtex/api is still seen by the DiagnosticsMetrics of
 * another, the same way global.diagnosticsMetrics itself is shared.
 *
 * Registration is order-independent: a cache constructed before the metrics
 * client exists (module-level caches load before startApp() creates the
 * global) sits in the registry until a DiagnosticsMetrics subscribes and
 * drains it.
 *
 * A name can be upgraded when a better origin shows up: a cache constructed
 * without a metricName registers under its callsite, and when it is later
 * passed as a client's memoryCache the name is renamed to the client's
 * (previousName on the event). Upgrades almost always land before the first
 * collection cycle, so the weaker name is never published.
 */

// Structural copy of the TrackedCache contract from metrics/DiagnosticsMetrics.ts,
// kept local so the caches layer never imports the metrics layer at runtime.
export interface TrackableCache {
  getCumulativeStats(): CumulativeStats
}

export interface CacheTrackingEvent {
  cache: TrackableCache
  name: string
  previousName?: string
  source: CacheNameSource
}

type CacheTrackingSubscriber = (event: CacheTrackingEvent) => void

interface RegistryEntry {
  cache: TrackableCache
  source: CacheNameSource
}

interface CacheTrackingRegistry {
  entries: Map<string, RegistryEntry>
  instances: WeakMap<TrackableCache, { name: string, source: CacheNameSource }>
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

const notify = (subscriber: CacheTrackingSubscriber, event: CacheTrackingEvent): void => {
  try {
    subscriber(event)
  } catch (error) {
    console.error('cacheTrackingRegistry: a subscriber threw while registering cache', event.name, error)
  }
}

/**
 * Registers a cache for observable metrics under `name`, tagged with the name's
 * origin (`explicit` for the metricName option and manual registrations, the
 * default; DiagnosticsMetrics subscribers receive the origin on the event).
 *
 * One name per instance: re-registering under the same name is a silent no-op;
 * under a weaker origin it is ignored (a derived name losing to a better one is
 * the design working, so it stays quiet); under a stronger origin the instance
 * is renamed and subscribers hear it as an event with previousName. Two
 * explicit names for one instance is the migration hazard — a metricName plus a
 * leftover manual trackCache call — and keeps the first name with a warning.
 *
 * One instance per name: a name already taken moves to the new instance with a
 * warning, except that a derived name (client or callsite) never steals a name
 * from a stronger or equal claim.
 */
export const registerCacheForTracking = (name: string, cache: TrackableCache, source: CacheNameSource = 'explicit'): void => {
  const { entries, instances, subscribers } = registry()

  const existing = instances.get(cache)
  if (existing && existing.name === name) {
    return
  }

  const holder = entries.get(name)
  const heldByAnother = holder !== undefined && holder.cache !== cache

  // A derived name claims nothing that a stronger or equal origin already holds,
  // whether the claim is on the instance (its current name) or on the name itself.
  if (existing && !outranks(source, existing.source)) {
    if (source === 'explicit' && existing.source === 'explicit') {
      console.warn(
        `cacheTrackingRegistry: this cache instance is already registered as '${existing.name}'; ` +
        `ignoring the registration as '${name}'. A double registration would count the same counters twice.`
      )
    }
    return
  }

  if (heldByAnother && source !== 'explicit' && !outranks(source, holder!.source)) {
    return
  }

  if (heldByAnother) {
    console.warn(
      `cacheTrackingRegistry: '${name}' was already registered to another cache instance; ` +
      `the name now points at the new one. Pick distinct names per cache.`
    )
    instances.delete(holder!.cache)
  }

  if (existing) {
    entries.delete(existing.name)
  }

  instances.set(cache, { name, source })
  entries.set(name, { cache, source })

  const event: CacheTrackingEvent = { cache, name, previousName: existing?.name, source }
  for (const subscriber of subscribers) {
    notify(subscriber, event)
  }
}

/**
 * Subscribes to registrations: drains every entry registered so far, then reports
 * each future one (including renames). Returns the unsubscribe function.
 */
export const subscribeToCacheTracking = (subscriber: CacheTrackingSubscriber): (() => void) => {
  const { entries, subscribers } = registry()

  subscribers.add(subscriber)
  for (const [name, { cache, source }] of entries) {
    notify(subscriber, { cache, name, source })
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
