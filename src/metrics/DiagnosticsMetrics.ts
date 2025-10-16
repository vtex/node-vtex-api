import { Attributes } from '@opentelemetry/api'
import { Types } from '@vtex/diagnostics-nodejs'
import { getMetricClient } from '../service/metrics/client'
import { METRIC_CLIENT_INIT_TIMEOUT_MS, LINKED } from '../constants'

/**
 * Maximum number of attributes allowed per metric to control cardinality.
 * This limit applies to external usage (VTEX IO Apps) to prevent unbounded metric dimensions.
 */
const MAX_ATTRIBUTES = 5

/**
 * Converts an hrtime tuple [seconds, nanoseconds] to milliseconds.
 */
function hrtimeToMillis(hrtime: [number, number]): number {
  return (hrtime[0] * 1e3) + (hrtime[1] / 1e6)
}

/**
 * Limits the number of attributes to prevent high cardinality.
 * Takes the first MAX_ATTRIBUTES entries if the limit is exceeded.
 * 
 * @param attributes Optional attributes object
 * @returns Limited attributes object or undefined
 */
function limitAttributes(attributes?: Attributes): Attributes | undefined {
  if (!attributes) {
    return undefined
  }

  const entries = Object.entries(attributes)
  if (entries.length <= MAX_ATTRIBUTES) {
    return attributes
  }

  if (LINKED) {
    console.warn(
      `Attribute limit exceeded: ${entries.length} attributes provided, using only the first ${MAX_ATTRIBUTES}. ` +
      `Consider reducing the number of attributes to avoid high cardinality.`
    )
  }

  return Object.fromEntries(entries.slice(0, MAX_ATTRIBUTES))
}

/**
 * DiagnosticsMetrics provides a high-level API for recording metrics using
 * the @vtex/diagnostics-nodejs library. It completely abstracts instrument
 * management, bucket configuration, and lifecycle.
 *
 * Uses a single histogram for all latency measurements with attributes to differentiate.
 * This follows OpenTelemetry best practices and reduces metric cardinality.
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
 * ```
 */
export class DiagnosticsMetrics {
  private metricsClient: Types.MetricClient | undefined
  private clientInitPromise: Promise<Types.MetricClient | undefined> | undefined

  private latencyHistogram: Types.Histogram | undefined
  // Counters and gauges keyed by name
  private counters: Map<string, Types.Counter>
  private gauges: Map<string, Types.Gauge>

  constructor() {
    this.counters = new Map()
    this.gauges = new Map()
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
   * Record a latency measurement using the single shared histogram.
   * Accepts either an hrtime tuple from process.hrtime() or milliseconds as a number.
   * Use attributes to differentiate between different operations.
   *
   * @param value Either [seconds, nanoseconds] from process.hrtime() or milliseconds
   * @param attributes Attributes including 'operation' to identify the operation type (max of MAX_ATTRIBUTES attributes)
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

    // Limit attributes to prevent high cardinality
    const limitedAttributes = limitAttributes(attributes)

    // Record to the single shared histogram with attributes
    this.latencyHistogram.record(milliseconds, limitedAttributes)
  }

  /**
   * Increment a counter by a specific value.
   * Multiple counters are stored by name since counters represent different types of events.
   *
   * @param name Counter name (e.g., 'http_requests_total', 'cache_hits_total')
   * @param value Amount to increment by (typically 1)
   * @param attributes Optional attributes for the counter (max of MAX_ATTRIBUTES attributes, e.g., { method: 'GET', status: '2xx' })
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

    // Limit attributes to prevent high cardinality
    const limitedAttributes = limitAttributes(attributes)

    // Increment the counter
    this.counters.get(name)!.add(value, limitedAttributes)
  }

  /**
   * Set a gauge to a specific value (current state).
   * Multiple gauges are stored by name since gauges represent different types of measurements.
   *
   * @param name Gauge name (e.g., 'cache_items_current', 'memory_usage_bytes')
   * @param value Current value
   * @param attributes Optional attributes for the gauge (max of MAX_ATTRIBUTES attributes, e.g., { cache: 'pages' })
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

    // Limit attributes to prevent high cardinality
    const limitedAttributes = limitAttributes(attributes)

    // Set the gauge value
    this.gauges.get(name)!.set(value, limitedAttributes)
  }
}

