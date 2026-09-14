import {
  Attributes,
  BatchObservableResult,
  context,
  createContextKey,
  Meter,
  MetricOptions,
  Observable,
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

// Meter for observable (pull-based) instruments — read by the SDK on its own
// collection schedule, unlike the push-based ones above.
const OBSERVABLE_METER_NAME = 'node-vtex-api'

// trackCache() metric names — one shared instrument set, differentiated by `cache`.
const CACHE_OPERATIONS_METRIC = 'io_app_cache_operations_total'
const CACHE_ITEMS_METRIC = 'io_app_cache_items_current'
const CACHE_CAPACITY_METRIC = 'io_app_cache_capacity'
const CACHE_DISPOSED_METRIC = 'io_app_cache_disposed_total'

/**
 * The stats shape trackCache() reads — matches LRUCache/DiskCache/LRUDiskCache/
 * MultilayeredCache's getStats() (see `../caches` and `GetStats` in
 * MetricsAccumulator.ts). `hits`/`total`/`disposedItems` reset on every read;
 * `itemCount`/`max` don't. Fields a cache doesn't have are just not reported.
 */
export interface TrackedCache {
  getStats(): { [key: string]: number | boolean | string | undefined }
}

// ObservableGauge and ObservableCounter are the same type in the OTel API
// (Observable), so registerObservableGauge/Counter share one implementation below,
// keyed by which kind of instrument to create.
type ObservableKind = 'gauge' | 'counter'
interface ObservableRegistration {
  observe: ObservableCallback
  options?: MetricOptions
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

  // Observable (pull-based) instruments: what apps asked to register, and what's
  // actually attached to an OTel instrument (empty until the client is ready — see
  // syncObservables). Re-registering a name replaces its callback.
  private observableRegistrations: Record<ObservableKind, Map<string, ObservableRegistration>>
  private observableInstruments: Record<ObservableKind, Map<string, { instrument: Observable; callback: ObservableCallback }>>

  // trackCache(): registered caches, their running cumulative totals (getStats()
  // resets on read — see observeCaches), and the shared instruments, created once.
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
    this.observableRegistrations = { gauge: new Map(), counter: new Map() }
    this.observableInstruments = { gauge: new Map(), counter: new Map() }
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

        // Attach any observable registrations made before the client was ready.
        // No-op if there are none.
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
  // Reaches the OTel MeterProvider via getProvider(), already part of the metrics
  // client's type — the same access node-vtex-api uses for HostMetricsInstrumentation
  // in service/telemetry/client.ts.
  private getObservableMeter(): Meter | undefined {
    return this.metricsClient?.getProvider().getMeter(OBSERVABLE_METER_NAME)
  }

  /**
   * Register (or replace, if `name` is already registered) a pull-based gauge: OTel
   * calls `observe` on its own collection schedule and expects `result.observe(value,
   * attributes?)`. Unlike the push-based methods above, base attributes are not
   * merged — there's no request in progress when this runs, so `observe` must supply
   * whatever attributes it needs.
   *
   * @returns A disposer that detaches the callback. Safe to call more than once, and
   * safe to call before the metrics client is ready.
   */
  public registerObservableGauge(name: string, observe: ObservableCallback, options?: MetricOptions): () => void {
    return this.registerObservable('gauge', name, observe, options)
  }

  /**
   * Same as `registerObservableGauge`, but for a monotonically increasing total:
   * `observe` must report the current cumulative value (the SDK derives the delta),
   * the same way `io_app_cache_operations_total` does below.
   */
  public registerObservableCounter(name: string, observe: ObservableCallback, options?: MetricOptions): () => void {
    return this.registerObservable('counter', name, observe, options)
  }

  private registerObservable(kind: ObservableKind, name: string, observe: ObservableCallback, options?: MetricOptions): () => void {
    this.observableRegistrations[kind].set(name, { observe, options })
    this.syncObservables(kind)

    return () => {
      if (this.observableRegistrations[kind].get(name)?.observe === observe) {
        this.observableRegistrations[kind].delete(name)
      }

      const active = this.observableInstruments[kind].get(name)
      if (active?.callback === observe) {
        active.instrument.removeCallback(observe)
        this.observableInstruments[kind].delete(name)
      }
    }
  }

  // Attaches every `kind` registration to its instrument. Safe to call anytime —
  // a no-op if the client isn't ready yet, or if nothing changed since last call.
  // This is what makes registering before the client is ready work: the caller
  // gets its disposer immediately, and the actual OTel wiring happens here, once,
  // whenever the meter becomes available (see flushPendingObservables).
  private syncObservables(kind: ObservableKind): void {
    // Checked before getObservableMeter(): an app that never registers anything of
    // this kind must never touch getProvider(), or the "inert unless used" guarantee
    // breaks for it.
    if (this.observableRegistrations[kind].size === 0) {
      return
    }

    const meter = this.getObservableMeter()
    if (!meter) {
      return
    }

    for (const [name, { observe, options }] of this.observableRegistrations[kind]) {
      const active = this.observableInstruments[kind].get(name)
      if (active?.callback === observe) {
        continue
      }

      if (active) {
        active.instrument.removeCallback(active.callback)
      }

      const instrument: Observable = active?.instrument ??
        (kind === 'gauge' ? meter.createObservableGauge(name, options) : meter.createObservableCounter(name, options))

      instrument.addCallback(observe)
      this.observableInstruments[kind].set(name, { instrument, callback: observe })
    }
  }

  // Attaches whatever was registered before the client was ready. No-op for an app
  // that never calls registerObservableGauge/Counter/trackCache.
  private flushPendingObservables(): void {
    this.syncObservables('gauge')
    this.syncObservables('counter')

    if (this.cacheRegistry.size > 0) {
      this.ensureCacheInstruments()
    }
  }

  /**
   * Replacement for the legacy `MetricsAccumulator.trackCache()`, taking the same
   * cache instances (LRUCache, DiskCache, LRUDiskCache, MultilayeredCache — see
   * `../caches`). Reads `getStats()` once per OTel collection cycle, not on any
   * schedule of its own, and folds the delta into a running total (see
   * `observeCaches`) since `hits`/`total`/`disposedItems` reset on every read.
   *
   * Migrate a cache by replacing the legacy `trackCache` call, not adding this one
   * alongside it — reading the same cache from both would split its counts between
   * them. Emits `io_app_cache_operations_total`, `_items_current`, `_capacity` and
   * `_disposed_total` (see METRICS_CATALOG.md); `hitRate` is not republished, derive
   * it from `_operations_total` instead.
   *
   * @returns A disposer that stops observing this cache. Safe to call more than once.
   */
  public trackCache(name: string, cacheInstance: TrackedCache): () => void {
    this.cacheRegistry.set(name, cacheInstance)
    this.ensureCacheInstruments()

    return () => {
      this.cacheRegistry.delete(name)
      this.cacheCumulative.delete(name)
    }
  }

  // Lazily creates the shared cache instruments and the one batch callback that
  // reads every registered cache per cycle. Idempotent — called from trackCache()
  // and, in case the client wasn't ready yet, from flushPendingObservables().
  private ensureCacheInstruments(): void {
    if (this.cacheInstruments) {
      return
    }

    const meter = this.getObservableMeter()
    if (!meter) {
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

  // The one callback backing every cache's instruments — reads each cache exactly
  // once per cycle (never twice, never split across two callbacks) and turns its
  // delta-on-read stats into a running cumulative total before observing it.
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
        console.error('DiagnosticsMetrics: failed to read stats for cache', name, error)
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

