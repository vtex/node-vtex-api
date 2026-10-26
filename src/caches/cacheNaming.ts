/**
 * Metric-name rules for tracked caches: where a name comes from, which origin
 * wins, and how a name is derived when the app does not give one. Kept apart
 * from trackingRegistry (which stores and broadcasts registrations) so every
 * derivation rule has one home.
 *
 * The three origins, strongest first:
 *
 * - explicit: the metricName constructor option, or a manual trackCache() call.
 *   The author named the cache; nothing overrides that.
 * - client: the name of the HttpClient a cache is passed to as memoryCache.
 *   Says what the cache is for; beats a callsite because it is stable while
 *   code moves around it.
 * - callsite: derived from where the cache is constructed, as a path relative
 *   to the app root plus an ordinal per file. Covers every cache, but adding,
 *   removing or reordering caches in one file renames that file's derived
 *   series — a rename a dashboard sees as one series going stale and a new
 *   one starting.
 */

export type CacheNameSource = 'callsite' | 'client' | 'explicit'

const SOURCE_RANK: Record<CacheNameSource, number> = {
  callsite: 1,
  client: 2,
  explicit: 3,
}

export const outranks = (candidate: CacheNameSource, current: CacheNameSource): boolean =>
  SOURCE_RANK[candidate] > SOURCE_RANK[current]

export interface CacheTrackingDecision {
  name: string
  source: CacheNameSource
}

/**
 * Parses the metricName option shared by the four cache classes: a string is an
 * explicit name, false opts the cache out of tracking entirely, and undefined
 * derives a name from the construction callsite.
 */
export const resolveCacheTracking = (metricName: string | false | undefined): CacheTrackingDecision | undefined => {
  if (metricName === false) {
    return undefined
  }

  if (typeof metricName === 'string' && metricName.length > 0) {
    return { name: metricName, source: 'explicit' }
  }

  const derived = deriveCallsiteName()
  return derived ? { name: derived, source: 'callsite' } : undefined
}

// Frames from this package's own plumbing are not a construction site: the four
// cache classes, this module and the registry. .ts under ts-jest, .js in lib.
const INTERNAL_FRAME = /[\\/]caches[\\/](?:LRUCache|LRUDiskCache|DiskCache|MultilayeredCache|cacheNaming|trackingRegistry)\.[jt]s/

const STACK_FRAME = /^\s*at\s+(?:[^()]+\()?(.+?):\d+:\d+\)?$/

// One ordinal per file: the first cache a file builds takes the plain path,
// the next ones a #N suffix, so two caches never collide on a derived name.
const ordinals = new Map<string, number>()

const relativize = (filePath: string): string => {
  const root = process.cwd().replace(/\\/g, '/')
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized
}

export const deriveCallsiteName = (): string | undefined => {
  const { stack } = new Error()
  if (!stack) {
    return undefined
  }

  for (const line of stack.split('\n')) {
    const match = STACK_FRAME.exec(line)
    if (!match) {
      continue
    }

    const [, filePath] = match
    if (filePath.startsWith('node:') || INTERNAL_FRAME.test(filePath)) {
      continue
    }

    const relative = relativize(filePath)
    const seen = (ordinals.get(relative) ?? 0) + 1
    ordinals.set(relative, seen)
    return seen === 1 ? relative : `${relative}#${seen}`
  }

  return undefined
}

/** Test support: derived names depend on construction order within a file. */
export const resetCacheNamingForTests = (): void => {
  ordinals.clear()
}
