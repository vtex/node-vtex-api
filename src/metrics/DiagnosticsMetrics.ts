import {
  Attributes,
  BatchObservableResult,
  context,
  createContextKey,
  Meter,
  MetricOptions,
  ObservableCallback,
  ObservableCounter,
  ObservableGauge,
} from '@opentelemetry/api'
import { Types } from '@vtex/diagnostics-nodejs'
import { getMetricClient } from '../service/metrics/client'
import { METRIC_CLIENT_INIT_TIMEOUT_MS, LINKED } from '../constants'

/**
 * Maximum number of custom attributes allowed per metric call to control cardinality.
 * This limit applies only to custom attributes provided by callers (VTEX IO Apps).
 * Base attributes (set via runWithBaseAttributes) are not counted toward this limit.
 * 
 * Total attributes sent = base attributes + custom attributes (up to MAX_CUSTOM_ATTRIBUTES)
 */
const MAX_CUSTOM_ATTRIBUTES = 7

/**
 * Context key for storing base attributes in OpenTelemetry context.
 * These attributes are automatically merged with custom attributes in all metric methods.
 */
const BASE_ATTRIBUTES_KEY = createContextKey('vtex.metrics.baseAttributes')

/**
 * Name of the meter used for observable (pull-based) instruments, i.e. instruments
 * whose value is read by a callback on the SDK's own collection schedule rather than
 * pushed by application code. Kept separate from per-app instrumentation names since
 * these instruments live at the node-vtex-api level.
 */
const OBSERVABLE_METER_NAME = 'node-vtex-api'

/**
 * Metric names for the trackCache() cache-visibility instruments. One shared set of
 * instruments differentiated by a `cache` attribute, following the same "single
 * instrument, many operations" pattern as the latency histogram.
 */
const CACHE_OPERATIONS_METRIC = 'io_app_cache_operations_total'
const CACHE_ITEMS_METRIC = 'io_app_cache_items_current'
const CACHE_CAPACITY_METRIC = 'io_app_cache_capacity'
const CACHE_DISPOSED_METRIC = 'io_app_cache_disposed_total'

/**
 * The subset of a VTEX IO cache's stats surface that trackCache() understands.
 * Matches the shape already returned by the LRUCache, DiskCache, LRUDiskCache and
 * MultilayeredCache classes' `getStats()` — see `src/caches/*.ts` and the `GetStats`
 * interface in `MetricsAccumulator.ts`, which this mirrors so the same cache instance
 * can be passed to either API.
 *
 * `hits` and `total` are expected to be a delta since the last read (all four cache
 * classes reset them on every `getStats()` call); `itemCount`/`length`/`max` are read
 * as the current state and are not reset. Fields absent from a given cache type
 * (e.g. DiskCache has no `itemCount`) are simply not reported.
 */
export interface TrackedCache {
  getStats(): { [key: string]: number | boolean | string | undefined }
}

/**
 * Converts an hrtime tuple [seconds, nanoseconds] to milliseconds.
 */
function hrtimeToMillis(hrtime: [number, number]): number {
  return (hrtime[0] * 1e3) + (hrtime[1] / 1e6)
}

/**
 * Limits the number of custom attributes to prevent high cardinality.
 * Takes the first MAX_CUSTOM_ATTRIBUTES entries if the limit is exceeded.
 * 
 * Note: This limit applies only to custom attributes. Base attributes are not limited.
 * 
 * @param customAttributes Optional custom attributes object
 * @returns Limited custom attributes object or undefined
 */
function limitCustomAttributes(customAttributes?: Attributes): Attributes | undefined {
  if (!customAttributes) {
    return undefined
  }

  const entries = Object.entries(customAttributes)
  if (entries.length <= MAX_CUSTOM_ATTRIBUTES) {
    return customAttributes
  }

  if (LINKED) {
    console.warn(
      `Custom attribute limit exceeded: ${entries.length} custom attributes provided, using only the first ${MAX_CUSTOM_ATTRIBUTES}. ` +
      `Consider reducing the number of custom attributes to avoid high cardinality. `
    )
  }

  return Object.fromEntries(entries.slice(0, MAX_CUSTOM_ATTRIBUTES))
}

/**
 * DiagnosticsMetrics provides a high-level API for recording metrics using
 * the @vtex/diagnostics-nodejs library. It completely abstracts instrument
 * management, bucket configuration, and lifecycle.
 *
 * Uses a single histogram for all latency measurements with attributes to differentiate.
 * This follows OpenTelemetry best practices and reduces metric cardinality.
 *
 * ## Base Attributes (Request Context)
 * 
 * DiagnosticsMetrics supports automatic merging of request-scoped "base attributes"
 * with custom attributes provided in each metric call. This is useful for automatically
 * including request context (account, status_code, route_id, etc.) in all metrics
 * recorded during a request lifecycle.
 *
 * Use `runWithBaseAttributes()` to set base attributes for a scope. All metric calls
 * within that scope will automatically include these base attributes, merged with
 * any custom attributes provided.
 * 
 * **Important:** Base attributes take precedence over custom attributes. If a custom
 * attribute has the same key as a base attribute, the custom attribute is silently
 * dropped and the base attribute value is used.
 *
 * @example
 * ```typescript
 * const diagnosticsMetrics = new DiagnosticsMetrics()
 * diagnosticsMetrics.initMetricClient()
 *
 * // Record latency with operation type in attributes
 * const start = process.hrtime()
 * // ... do work ...
 * diagnosticsMetrics.recordLatency(process.hrtime(start), { operation: 'api-call', status: '2xx' })
 *
 * // Or from milliseconds
 * diagnosticsMetrics.recordLatency(42.5, { operation: 'db-query', status: 'success' })
 *
 * // Increment a counter
 * diagnosticsMetrics.incrementCounter('http_requests_total', 1, { method: 'GET', status: '2xx' })
 *
 * // Set a gauge value
 * diagnosticsMetrics.setGauge('cache_items_current', 1024, { cache: 'pages' })
 *
 * // Using base attributes for request context
 * await diagnosticsMetrics.runWithBaseAttributes(
 *   { 'vtex.account.name': 'mystore', status_code: 200 },
 *   async () => {
 *     // All metrics recorded here will include the base attributes
 *     diagnosticsMetrics.recordLatency(100, { operation: 'custom-op' })
 *     // Result: { 'vtex.account.name': 'mystore', status_code: 200, operation: 'custom-op' }
 *   }
 * )
 * ```
 */
export class DiagnosticsMetrics {
  private metricsClient: Types.MetricClient | undefined
  private clientInitPromise: Promise<Types.MetricClient | undefined> | undefined

  private latencyHistogram: Types.Histogram | undefined
  // Counters and gauges keyed by name
  private counters: Map<string, Types.Counter>
  private gauges: Map<string, Types.Gauge>

  // Observable (pull-based) instruments, keyed by name. Each entry tracks the
  // OTel instrument handle alongside the callback currently attached to it, so a
  // second registration under the same name can detach the old callback before
  // attaching the new one instead of accumulating callbacks on the same instrument.
  private observableGauges: Map<string, { instrument: ObservableGauge; callback: ObservableCallback }>
  private observableCounters: Map<string, { instrument: ObservableCounter; callback: ObservableCallback }>

  // Observable registrations requested before the metrics client finished initializing.
  // The metrics client initializes asynchronously (see initMetricClient), while apps
  // typically call trackCache/registerObservableGauge/registerObservableCounter
  // synchronously at module load time — often before that initialization completes.
  // Without this, those early registrations would be silently dropped. Replayed by
  // flushPendingObservables() once the client becomes available.
  private pendingObservableGauges: Map<string, { observe: ObservableCallback; options?: MetricOptions }>
  private pendingObservableCounters: Map<string, { observe: ObservableCallback; options?: MetricOptions }>

  // trackCache() state: caches registered for observation, the running cumulative
  // totals derived from their delta-on-read stats (see TrackedCache), and the shared
  // instruments + batch callback created once on first use.
  private cacheRegistry: Map<string, TrackedCache>
  private cacheCumulative: Map<string, { hits: number; misses: number; disposed: number }>
  private cacheInstruments: {
    operations: ObservableCounter
    items: ObservableGauge
    capacity: ObservableGauge
    disposed: ObservableCounter
  } | undefined

  constructor() {
    this.counters = new Map()
    this.gauges = new Map()
    this.observableGauges = new Map()
    this.observableCounters = new Map()
    this.pendingObservableGauges = new Map()
    this.pendingObservableCounters = new Map()
    this.cacheRegistry = new Map()
    this.cacheCumulative = new Map()
    this.initMetricClient()
  }

  /**
   * Initialize the metrics client with timeout handling.
   * Called automatically in constructor.
   */
  private initMetricClient(): Promise<Types.MetricClient | undefined> {
    if (this.clientInitPromise) {
      return this.clientInitPromise
    }

    this.clientInitPromise = (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Metric client initialization timeout')), METRIC_CLIENT_INIT_TIMEOUT_MS)
        })

        this.metricsClient = await Promise.race([
          getMetricClient(),
          timeoutPromise
        ])

        // Create the single latency histogram after client is ready
        this.createLatencyHistogram()

        // Replay any registerObservableGauge/registerObservableCounter/trackCache
        // calls that arrived before the client was ready. No-op if none arrived —
        // apps that never call these APIs are unaffected by this step.
        this.flushPendingObservables()

        return this.metricsClient
      } catch (error) {
        console.error('Failed to initialize metric client:', error)
        return undefined
      }
    })()

    return this.clientInitPromise
  }

  /**
   * Create the single shared histogram for all latency measurements.
   * Called after metric client is initialized.
   */
  private createLatencyHistogram(): void {
    if (!this.metricsClient) {
      return
    }

    this.latencyHistogram = this.metricsClient.createHistogram('io_app_operation_duration_milliseconds', {
      description: 'Duration of VTEX IO app operations in milliseconds',
      unit: 'ms',
    })
  }

  /**
   * Execute a function with base attributes set in the OpenTelemetry context.
   * All metric calls within the function will automatically include these base attributes,
   * merged with any custom attributes provided in each call.
   * 
   * Base attributes take precedence over custom attributes when there are key conflicts.
   * Conflicting custom attributes are silently dropped.
   *
   * @param baseAttributes Base attributes to include in all metrics within the scope
   * @param fn Function to execute with the base attributes context
   * @returns The return value of the function
   *
   * @example
   * ```typescript
   * // In a request middleware
   * await diagnosticsMetrics.runWithBaseAttributes(
   *   {
   *     'vtex.account.name': ctx.vtex.account,
   *     status_code: ctx.status,
   *     route_id: ctx.vtex.route.id,
   *   },
   *   async () => {
   *     await next()
   *   }
   * )
   * 
   * // In app code (custom attributes are merged with base)
   * diagnosticsMetrics.recordLatency(elapsed, { operation: 'my-operation', status: 'success' })
   * // Result includes both base attributes AND custom attributes
   * ```
   */
  public runWithBaseAttributes<T>(baseAttributes: Attributes, fn: () => T): T {
    const currentContext = context.active()
    const newContext = currentContext.setValue(BASE_ATTRIBUTES_KEY, baseAttributes)
    return context.with(newContext, fn)
  }

  /**
   * Get the base attributes from the current OpenTelemetry context.
   * Returns undefined if no base attributes are set.
   */
  private getBaseAttributes(): Attributes | undefined {
    return context.active().getValue(BASE_ATTRIBUTES_KEY) as Attributes | undefined
  }

  /**
   * Merge base attributes from context with provided custom attributes.
   * Base attributes take precedence over custom attributes when there are key conflicts.
   * 
   * Custom attributes are limited to MAX_CUSTOM_ATTRIBUTES before merging.
   * Custom attributes with keys that conflict with base attributes are silently dropped.
   * Base attributes are not limited.
   * 
   * @param customAttributes Custom attributes provided by the caller
   * @returns Merged attributes (base + non-conflicting limited custom) or undefined if both are empty
   */
  private mergeAttributes(customAttributes?: Attributes): Attributes | undefined {
    const baseAttributes = this.getBaseAttributes()
    
    // Limit custom attributes before merging
    const limitedCustomAttributes = limitCustomAttributes(customAttributes)
    
    if (!baseAttributes && !limitedCustomAttributes) {
      return undefined
    }
    
    if (!baseAttributes) {
      return limitedCustomAttributes
    }
    
    if (!limitedCustomAttributes) {
      return baseAttributes
    }
    
    // Filter out custom attributes that conflict with base attributes (base takes precedence)
    const baseKeys = new Set(Object.keys(baseAttributes))
    const nonConflictingCustomAttributes: Attributes = {}
    
    for (const [key, value] of Object.entries(limitedCustomAttributes)) {
      if (!baseKeys.has(key)) {
        nonConflictingCustomAttributes[key] = value
      }
      // Silently drop conflicting custom attributes - base attributes take precedence
    }
    
    // Merge: base attributes + non-conflicting custom attributes
    return { ...baseAttributes, ...nonConflictingCustomAttributes }
  }

  /**
   * Record a latency measurement using the single shared histogram.
   * Accepts either an hrtime tuple from process.hrtime() or milliseconds as a number.
   * Use attributes to differentiate between different operations.
   * 
   * Base attributes from the current context (set via `runWithBaseAttributes`) are
   * automatically merged with the provided custom attributes. Base attributes take 
   * precedence - if a custom attribute key conflicts with a base attribute key, 
   * the custom attribute is silently dropped.
   * 
   * Custom attributes are limited to MAX_CUSTOM_ATTRIBUTES (5). Base attributes are not limited.
   *
   * @param value Either [seconds, nanoseconds] from process.hrtime() or milliseconds
   * @param attributes Custom attributes including 'operation' to identify the operation type (max 5 custom attributes)
   *
   * @example
   * ```typescript
   * const start = process.hrtime()
   * // ... do work ...
   * diagnosticsMetrics.recordLatency(process.hrtime(start), { operation: 'api-call', status: '2xx' })
   * 
   * // Or with milliseconds
   * diagnosticsMetrics.recordLatency(42.5, { operation: 'db-query', status: 'success' })
   * ```
   */
  public recordLatency(value: [number, number] | number, attributes?: Attributes): void {
    if (!this.latencyHistogram) {
      console.warn('DiagnosticsMetrics not initialized. Call initialize() first.')
      return
    }

    // Convert hrtime to milliseconds if needed
    const milliseconds = Array.isArray(value) ? hrtimeToMillis(value) : value

    // Merge base attributes from context with custom attributes (custom attrs are limited internally)
    const mergedAttributes = this.mergeAttributes(attributes)

    // Record to the single shared histogram with merged attributes
    this.latencyHistogram.record(milliseconds, mergedAttributes)
  }

  /**
   * Increment a counter by a specific value.
   * Multiple counters are stored by name since counters represent different types of events.
   * 
   * Base attributes from the current context (set via `runWithBaseAttributes`) are
   * automatically merged with the provided custom attributes. Base attributes take 
   * precedence - if a custom attribute key conflicts with a base attribute key, 
   * the custom attribute is silently dropped.
   * 
   * Custom attributes are limited to MAX_CUSTOM_ATTRIBUTES (5). Base attributes are not limited.
   *
   * @param name Counter name (e.g., 'http_requests_total', 'cache_hits_total')
   * @param value Amount to increment by (typically 1)
   * @param attributes Optional custom attributes for the counter (max 5 custom attributes, e.g., { method: 'GET', status: '2xx' })
   *
   * @example
   * ```typescript
   * diagnosticsMetrics.incrementCounter('http_requests_total', 1, { method: 'GET', status: '2xx' })
   * ```
   */
  public incrementCounter(name: string, value: number, attributes?: Attributes): void {
    if (!this.metricsClient) {
      console.warn('DiagnosticsMetrics not initialized. Call initialize() first.')
      return
    }

    // Get or create counter instrument
    if (!this.counters.has(name)) {
      const counter = this.metricsClient.createCounter(name, {
        description: `Counter for ${name}`,
        unit: '1',
      })
      this.counters.set(name, counter)
    }

    // Merge base attributes from context with custom attributes (custom attrs are limited internally)
    const mergedAttributes = this.mergeAttributes(attributes)

    // Increment the counter
    this.counters.get(name)!.add(value, mergedAttributes)
  }

  /**
   * Set a gauge to a specific value (current state).
   * Multiple gauges are stored by name since gauges represent different types of measurements.
   * 
   * Base attributes from the current context (set via `runWithBaseAttributes`) are
   * automatically merged with the provided custom attributes. Base attributes take 
   * precedence - if a custom attribute key conflicts with a base attribute key, 
   * the custom attribute is silently dropped.
   * 
   * Custom attributes are limited to MAX_CUSTOM_ATTRIBUTES (5). Base attributes are not limited.
   *
   * @param name Gauge name (e.g., 'cache_items_current', 'memory_usage_bytes')
   * @param value Current value
   * @param attributes Optional custom attributes for the gauge (max 5 custom attributes, e.g., { cache: 'pages' })
   *
   * @example
   * ```typescript
   * diagnosticsMetrics.setGauge('cache_items_current', 1024, { cache: 'pages' })
   * ```
   */
  public setGauge(name: string, value: number, attributes?: Attributes): void {
    if (!this.metricsClient) {
      console.warn('DiagnosticsMetrics not initialized. Call initialize() first.')
      return
    }

    // Get or create gauge instrument
    if (!this.gauges.has(name)) {
      const gauge = this.metricsClient.createGauge(name, {
        description: `Gauge for ${name}`,
        unit: '1',
      })
      this.gauges.set(name, gauge)
    }

    // Merge base attributes from context with custom attributes (custom attrs are limited internally)
    const mergedAttributes = this.mergeAttributes(attributes)

    // Set the gauge value
    this.gauges.get(name)!.set(value, mergedAttributes)
  }

  /**
   * Get the meter used for observable instruments, if the metrics client is ready.
   * Reaches the OpenTelemetry MeterProvider through `getProvider()`, which is already
   * part of the metrics client's public surface (the same access node-vtex-api uses
   * for HostMetricsInstrumentation in service/telemetry/client.ts).
   */
  private getObservableMeter(): Meter | undefined {
    return this.metricsClient?.getProvider().getMeter(OBSERVABLE_METER_NAME)
  }

  /**
   * Register (or replace) the callback for a named observable gauge instrument.
   *
   * Base attributes from `runWithBaseAttributes` are NOT merged here: observable
   * callbacks run on the SDK's own collection schedule, not within a request, so
   * there is no request-scoped context to merge in. The `observe` callback is
   * responsible for supplying whatever attributes it needs directly.
   *
   * @param name Instrument name (e.g. 'queue_depth_current')
   * @param observe Called by the OTel SDK on each collection cycle; use
   *   `result.observe(value, attributes?)` to report the current value
   * @param options Optional instrument metadata (description, unit)
   * @returns A disposer that detaches this callback. Safe to call more than once.
   *
   * @example
   * ```typescript
   * const dispose = diagnosticsMetrics.registerObservableGauge(
   *   'queue_depth_current',
   *   (result) => result.observe(queue.length),
   *   { description: 'Items currently queued', unit: '1' }
   * )
   * // later, if the queue goes away:
   * dispose()
   * ```
   */
  public registerObservableGauge(name: string, observe: ObservableCallback, options?: MetricOptions): () => void {
    if (!this.metricsClient) {
      this.pendingObservableGauges.set(name, { observe, options })
      return () => this.detachPendingOrActiveObservableGauge(name, observe)
    }

    return this.attachObservableGauge(name, observe, options)
  }

  /**
   * Register (or replace) the callback for a named observable counter instrument.
   * Unlike `incrementCounter`, the callback must report the current cumulative total
   * on each collection cycle (not a delta) — the SDK computes the delta itself.
   *
   * See `registerObservableGauge` for the base-attributes caveat and the "replace on
   * re-registration" behavior.
   *
   * @param name Instrument name (e.g. 'jobs_processed_total')
   * @param observe Called by the OTel SDK on each collection cycle; use
   *   `result.observe(cumulativeValue, attributes?)`
   * @param options Optional instrument metadata (description, unit)
   * @returns A disposer that detaches this callback. Safe to call more than once.
   */
  public registerObservableCounter(name: string, observe: ObservableCallback, options?: MetricOptions): () => void {
    if (!this.metricsClient) {
      this.pendingObservableCounters.set(name, { observe, options })
      return () => this.detachPendingOrActiveObservableCounter(name, observe)
    }

    return this.attachObservableCounter(name, observe, options)
  }

  private attachObservableGauge(name: string, observe: ObservableCallback, options?: MetricOptions): () => void {
    const meter = this.getObservableMeter()
    if (!meter) {
      console.warn('DiagnosticsMetrics not initialized. Call initialize() first.')
      return () => {}
    }

    const existing = this.observableGauges.get(name)
    const instrument = existing?.instrument ?? meter.createObservableGauge(name, options)
    if (existing) {
      existing.instrument.removeCallback(existing.callback)
    }

    instrument.addCallback(observe)
    this.observableGauges.set(name, { instrument, callback: observe })

    return () => this.detachPendingOrActiveObservableGauge(name, observe)
  }

  private attachObservableCounter(name: string, observe: ObservableCallback, options?: MetricOptions): () => void {
    const meter = this.getObservableMeter()
    if (!meter) {
      console.warn('DiagnosticsMetrics not initialized. Call initialize() first.')
      return () => {}
    }

    const existing = this.observableCounters.get(name)
    const instrument = existing?.instrument ?? meter.createObservableCounter(name, options)
    if (existing) {
      existing.instrument.removeCallback(existing.callback)
    }

    instrument.addCallback(observe)
    this.observableCounters.set(name, { instrument, callback: observe })

    return () => this.detachPendingOrActiveObservableCounter(name, observe)
  }

  private detachPendingOrActiveObservableGauge(name: string, observe: ObservableCallback): void {
    if (this.pendingObservableGauges.get(name)?.observe === observe) {
      this.pendingObservableGauges.delete(name)
    }

    const active = this.observableGauges.get(name)
    if (active?.callback === observe) {
      active.instrument.removeCallback(observe)
      this.observableGauges.delete(name)
    }
  }

  private detachPendingOrActiveObservableCounter(name: string, observe: ObservableCallback): void {
    if (this.pendingObservableCounters.get(name)?.observe === observe) {
      this.pendingObservableCounters.delete(name)
    }

    const active = this.observableCounters.get(name)
    if (active?.callback === observe) {
      active.instrument.removeCallback(observe)
      this.observableCounters.delete(name)
    }
  }

  /**
   * Replay observable registrations that arrived before the metrics client was ready.
   * Called once, right after the client finishes initializing. A no-op for any app
   * that never calls registerObservableGauge/registerObservableCounter/trackCache.
   */
  private flushPendingObservables(): void {
    for (const [name, { observe, options }] of this.pendingObservableGauges) {
      this.attachObservableGauge(name, observe, options)
    }

    this.pendingObservableGauges.clear()

    for (const [name, { observe, options }] of this.pendingObservableCounters) {
      this.attachObservableCounter(name, observe, options)
    }

    this.pendingObservableCounters.clear()

    // Only touch the cache instruments if trackCache() actually registered something
    // before the client was ready. Calling ensureCacheInstruments() unconditionally
    // here would call getProvider() on every DiagnosticsMetrics instance, including
    // apps that never call trackCache() — the opposite of the "inert unless used"
    // guarantee this feature is meant to keep.
    if (this.cacheRegistry.size > 0) {
      this.ensureCacheInstruments()
    }
  }

  /**
   * Register a cache for periodic, pull-based observation — the DiagnosticsMetrics
   * replacement for the legacy MetricsAccumulator.trackCache(). Accepts the same
   * cache instances already in use today (LRUCache, DiskCache, LRUDiskCache,
   * MultilayeredCache from `../caches`).
   *
   * Unlike the legacy trackCache, this does not read `cacheInstance.getStats()`
   * immediately or on any fixed schedule of its own — it is read once per OTel
   * collection cycle, from a single shared callback covering every registered cache,
   * so that a cache's delta-on-read counters (`hits`, `total`, `disposedItems`) are
   * never read twice in the same cycle and split between two callers.
   *
   * There is deliberately no dual-write path with the legacy `trackCache`: reading
   * the same cache from both would divide its hit/miss counts between them. Replace
   * the legacy call with this one in the same change, not alongside it.
   *
   * Emits, per registered cache (attribute `cache` = the name passed here):
   * - `io_app_cache_operations_total` (counter, attribute `cache_state`: 'hit' | 'miss')
   * - `io_app_cache_items_current` (gauge) — only if the cache reports `itemCount`
   * - `io_app_cache_capacity` (gauge) — only if the cache reports `max`
   * - `io_app_cache_disposed_total` (counter) — only if the cache reports `disposedItems`
   *
   * `hitRate` is intentionally not republished — it is derivable from the operations
   * counter, and publishing it directly would prevent correct aggregation across
   * instances.
   *
   * @param name Cache name (e.g. 'pages') — becomes the `cache` attribute
   * @param cacheInstance Any cache exposing `getStats()` in the legacy shape
   * @returns A disposer that stops observing this cache. Safe to call more than once.
   *
   * @example
   * ```typescript
   * const dispose = diagnosticsMetrics.trackCache('pages', pagesCacheStorage)
   * ```
   */
  public trackCache(name: string, cacheInstance: TrackedCache): () => void {
    this.cacheRegistry.set(name, cacheInstance)
    this.ensureCacheInstruments()

    return () => {
      this.cacheRegistry.delete(name)
      this.cacheCumulative.delete(name)
    }
  }

  /**
   * Lazily create the shared cache instruments and the single batch callback that
   * reads every registered cache once per collection cycle. Idempotent: safe to call
   * from both `trackCache()` (in case the client is already ready) and
   * `flushPendingObservables()` (in case it was not).
   */
  private ensureCacheInstruments(): void {
    if (this.cacheInstruments) {
      return
    }

    const meter = this.getObservableMeter()
    if (!meter) {
      // Not ready yet. trackCache() already recorded the cache in cacheRegistry;
      // flushPendingObservables() will call this again once the client is ready.
      return
    }

    const operations = meter.createObservableCounter(CACHE_OPERATIONS_METRIC, {
      description: 'Hit/miss operations for a VTEX IO app in-memory cache',
      unit: '1',
    })
    const items = meter.createObservableGauge(CACHE_ITEMS_METRIC, {
      description: 'Current number of items held by a VTEX IO app cache',
      unit: '1',
    })
    const capacity = meter.createObservableGauge(CACHE_CAPACITY_METRIC, {
      description: 'Maximum number of items a VTEX IO app cache can hold',
      unit: '1',
    })
    const disposed = meter.createObservableCounter(CACHE_DISPOSED_METRIC, {
      description: 'Items disposed (evicted) from a VTEX IO app cache',
      unit: '1',
    })

    meter.addBatchObservableCallback(
      (result) => this.observeCaches(result),
      [operations, items, capacity, disposed]
    )

    this.cacheInstruments = { operations, items, capacity, disposed }
  }

  /**
   * The single callback backing every registered cache's instruments. Reads each
   * cache's `getStats()` exactly once per collection cycle and folds the delta into
   * a running cumulative total (see the class-level note on trackCache), since
   * `hits`/`total`/`disposedItems` reset on every read.
   */
  private observeCaches(result: BatchObservableResult): void {
    if (!this.cacheInstruments) {
      return
    }

    const { operations, items, capacity, disposed } = this.cacheInstruments

    for (const [name, cache] of this.cacheRegistry) {
      let stats: { [key: string]: number | boolean | string | undefined }
      try {
        stats = cache.getStats()
      } catch (error) {
        console.error(`DiagnosticsMetrics: failed to read stats for cache '${name}':`, error)
        continue
      }

      const running = this.cacheCumulative.get(name) ?? { hits: 0, misses: 0, disposed: 0 }
      const hits = typeof stats.hits === 'number' ? stats.hits : 0
      const total = typeof stats.total === 'number' ? stats.total : 0
      running.hits += hits
      running.misses += Math.max(total - hits, 0)

      const attributes = { cache: name }
      result.observe(operations, running.hits, { ...attributes, cache_state: 'hit' })
      result.observe(operations, running.misses, { ...attributes, cache_state: 'miss' })

      if (typeof stats.itemCount === 'number') {
        result.observe(items, stats.itemCount, attributes)
      }

      if (typeof stats.max === 'number') {
        result.observe(capacity, stats.max, attributes)
      }

      if (typeof stats.disposedItems === 'number') {
        running.disposed += stats.disposedItems
        result.observe(disposed, running.disposed, attributes)
      }

      this.cacheCumulative.set(name, running)
    }
  }
}

