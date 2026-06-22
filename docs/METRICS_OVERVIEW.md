# Metrics Migration Guide for VTEX IO Apps

This document provides comprehensive guidance for migrating from the legacy `MetricsAccumulator` API to the new `DiagnosticsMetrics` API, including patterns, best practices, and production-validated examples.

> **Looking for the complete metrics catalog?** See [METRICS_CATALOG.md](./METRICS_CATALOG.md) for a comprehensive list of all available metrics.

## Table of Contents

- [Why Migrate?](#why-migrate)
- [Quick Start](#quick-start)
- [Common Migration Patterns](#common-migration-patterns)
- [What Doesn't Need Migration](#what-doesnt-need-migration)
- [Additional Examples from Production Apps](#additional-examples-from-production-apps)
- [Best Practices for Metrics Design](#best-practices-for-metrics-design)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Why Migrate?

The new `DiagnosticsMetrics` API provides:

✅ **Better Performance**: No in-memory aggregation, lower memory overhead  
✅ **Modern Observability**: OpenTelemetry-based metrics exported to backend  
✅ **Better Dashboards**: Attribute-based metrics for flexible querying  
✅ **Cardinality Control**: Built-in limits to prevent metric explosion  
✅ **Type Safety**: Full TypeScript support with clear APIs  

---

## Quick Start

### Before (Legacy API)

```typescript
import { MetricsAccumulator } from '@vtex/api'

const metrics = new MetricsAccumulator()

const start = process.hrtime()
const result = await fetchData()
metrics.batch('fetch-data', process.hrtime(start), { success: 1 })
```

### After (New API)

```typescript
// DiagnosticsMetrics is available globally
const { diagnosticsMetrics } = global

const start = process.hrtime()
const result = await fetchData()
diagnosticsMetrics.recordLatency(process.hrtime(start), {
  operation: 'fetch-data',
  status: 'success'
})
diagnosticsMetrics.incrementCounter('fetch_data_total', 1, {
  status: 'success'
})
```

---

## Common Migration Patterns

### Pattern 1: Simple Latency Recording

**Before:**
```typescript
const start = process.hrtime()
const result = await apiCall()
metrics.batch('api-call', process.hrtime(start))
```

**After:**
```typescript
const start = process.hrtime()
const result = await apiCall()
global.diagnosticsMetrics.recordLatency(process.hrtime(start), {
  operation: 'api-call',
  status: 'success'
})
```

> 📌 **Production Example:** See this pattern in action in [render-to-string's `trackOperation()` utility](https://github.com/vtex/render-to-string/blob/master/node/utils/metrics.ts), which wraps operations with `recordLatency()`.

### Pattern 2: Latency with Success/Error Tracking

**Before:**
```typescript
const start = process.hrtime()
try {
  const result = await apiCall()
  metrics.batch('api-call', process.hrtime(start), { success: 1 })
  return result
} catch (error) {
  metrics.batch('api-call', process.hrtime(start), { error: 1 })
  throw error
}
```

**After:**
```typescript
const start = process.hrtime()
try {
  const result = await apiCall()
  global.diagnosticsMetrics.recordLatency(process.hrtime(start), {
    operation: 'api-call',
    status: 'success'
  })
  return result
} catch (error) {
  global.diagnosticsMetrics.recordLatency(process.hrtime(start), {
    operation: 'api-call',
    status: 'error'
  })
  throw error
}
```

> 📌 **Production Example:** The [render-to-string's `emitMetrics()` function](https://github.com/vtex/render-to-string/blob/master/node/utils/metrics.ts) records latency with `status: 'success'` or `status: 'error'` based on whether the operation succeeded or failed.

### Pattern 3: Mixed Extensions (Numbers and Strings)

**Before:**
```typescript
metrics.batch('http-request', elapsed, {
  success: 1,      // Counter
  '2xx': 1,        // Counter
  'cache-hit': 1,  // Counter
  region: 'us'     // Attribute
})
```

**After:**
```typescript
// Record latency with attributes
global.diagnosticsMetrics.recordLatency(elapsed, {
  operation: 'http-request',
  status: '2xx',
  cache: 'hit',
  region: 'us'
})
```

> 📌 **Production Example:** In [render-to-string's render middleware](https://github.com/vtex/render-to-string/blob/master/node/middleware/render.ts), extra attributes like `{ template: templateName }` are passed alongside latency recordings.

### Pattern 4: Cache Tracking

**Before:**
```typescript
// Manual cache stats collection
const stats = cache.getStats()
console.log(`Cache hits: ${stats.hits}, misses: ${stats.misses}`)
```

**After:**
```typescript
// Direct API calls for cache metrics
const stats = cache.getStats()
global.diagnosticsMetrics.incrementCounter('cache_hits_total', stats.hits, {
  cache: 'my-cache'
})
global.diagnosticsMetrics.incrementCounter('cache_misses_total', stats.misses, {
  cache: 'my-cache'
})
global.diagnosticsMetrics.setGauge('cache_items_current', stats.size, {
  cache: 'my-cache'
})
```

> 📌 **Production Example:** The [render-to-string's `recordCacheMetric()` function](https://github.com/vtex/render-to-string/blob/master/node/utils/metrics.ts) uses `incrementCounter('cache_operations_total', 1, { cache, cache_state })` for unified cache tracking.

---

## What Doesn't Need Migration

### HTTP Client with `metric:` Config Option

**No changes needed!** The HTTP client middleware was already migrated internally.

```typescript
// This already uses DiagnosticsMetrics internally
this.http.get(`/user/${email}/isAdmin`, {
  metric: 'sphinx-is-admin'  // ✅ Works automatically
})
```

> 📌 **Production Example:** See this in [render-to-string's Assets client](https://github.com/vtex/render-to-string/blob/master/node/clients/assets.ts) using `metric: 'assets-fetch'`.

### GraphQL `@metric` Directive

**No changes needed!** The directive was already migrated internally.

```typescript
export const resolvers = {
  Query: {
    @metric  // ✅ Already using DiagnosticsMetrics
    async products(_: any, __: any, ctx: Context) {
      return ctx.clients.catalog.getProducts()
    }
  }
}
```

---

## Additional Examples from Production Apps

Beyond the basic migration patterns (1-4), apps with complex instrumentation needs can benefit from additional patterns. The **[render-to-string](https://github.com/vtex/render-to-string)** app demonstrates these advanced techniques in production.

### Centralized Metrics Utility

When your app has many operations that need instrumentation, reduce boilerplate by creating a centralized utility that combines metrics, logging, and backward compatibility.

**render-to-string implementation:** [`node/utils/metrics.ts`](https://github.com/vtex/render-to-string/blob/master/node/utils/metrics.ts)

```typescript
// The trackOperation() utility wraps any operation with standardized instrumentation
import { hrToMillis } from '@vtex/api'

export interface OperationContext {
  account: string
  workspace: string
  operationId: string
  logger: {
    info: (data: Record<string, any>) => void
    error: (data: Record<string, any>) => void
  }
}

export interface TrackOperationOptions {
  name: string
  ctx: OperationContext
  extraAttributes?: Record<string, string>
}

function emitMetrics(
  options: TrackOperationOptions,
  elapsed: [number, number],
  status: 'success' | 'error'
): void {
  const { name, ctx, extraAttributes = {} } = options
  const { account, workspace, operationId, logger } = ctx
  const timeMs = hrToMillis(elapsed)

  // Legacy metrics API (backward compatibility)
  metrics.batchMetric(name, timeMs, { account, workspace, status })

  // New diagnostics metrics API (OTel-compliant)
  global.diagnosticsMetrics?.recordLatency(elapsed, {
    operation: name,
    status,
    ...extraAttributes,
  })

  // Structured logging
  const logData = { message: name, operationId, timeMs, ...extraAttributes }
  status === 'success' ? logger.info(logData) : logger.error({ ...logData, error: true })
}

export async function trackOperation<T>(
  options: TrackOperationOptions,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = process.hrtime()
  try {
    const result = await fn()
    emitMetrics(options, process.hrtime(start), 'success')
    return result
  } catch (error) {
    emitMetrics(options, process.hrtime(start), 'error')
    throw error
  }
}
```

**Why this works:** Reduces ~250 lines of boilerplate to ~30 lines while maintaining dual API support.

### Tracking Multiple Operations in a Flow

For complex middleware with multiple sub-operations, use the utility for each logical step.

**render-to-string implementation:** [`node/middleware/render.ts`](https://github.com/vtex/render-to-string/blob/master/node/middleware/render.ts)

```typescript
export async function render(ctx: Context, next: () => Promise<any>) {
  const { vtex: { account, workspace, operationId } } = ctx
  const metricsCtx = { account, workspace, operationId, logger: vtex.logger }

  // Each operation is tracked independently
  const compiledScripts = await trackOperation(
    { name: 'vm-script', ctx: metricsCtx },
    () => getCompiledScripts(assetsClient, assets)
  )

  await trackOperation(
    { name: 'vm-run-in-context', ctx: metricsCtx },
    () => compiledScripts.forEach(script => vm.run(script))
  )

  const rendered = await trackOperation(
    { name: 'vm-global-rendered', ctx: metricsCtx },
    () => vm.run('global.rendered')
  )

  await next()
}
```

### Recording Pre-Measured Metrics

When timing data comes from external sources (e.g., VM sandbox, third-party libraries), record it separately.

**render-to-string implementation:** [`node/middleware/render.ts`](https://github.com/vtex/render-to-string/blob/master/node/middleware/render.ts)

```typescript
// Timings captured inside VM are recorded after extraction
const { getDataFromTree, renderToString } = renderMetrics[templateName]
if (getDataFromTree) {
  recordExternalMetrics(
    { name: 'data-from-tree-ssr', ctx: metricsCtx, extraAttributes: { template: templateName } },
    getDataFromTree
  )
}
if (renderToString) {
  recordExternalMetrics(
    { name: 'to-string-ssr', ctx: metricsCtx, extraAttributes: { template: templateName } },
    renderToString
  )
}
```

### Error Classification for Debugging

Classify error types as attributes for better debugging and alerting.

**render-to-string implementation:** [`node/middleware/render.ts`](https://github.com/vtex/render-to-string/blob/master/node/middleware/render.ts)

```typescript
try {
  // ... operation
} catch (e) {
  // Classify error type for metrics
  let errorType = 'unknown'
  if (e instanceof SSRFailError) {
    errorType = 'ssr-fail'
  } else if (e.code === 'ETIMEDOUT') {
    errorType = 'timeout'
  } else if (e.code === 'ECONNREFUSED') {
    errorType = 'connection-refused'
  } else if (e.name === 'TimeoutError') {
    errorType = 'vm-timeout'
  }

  global.diagnosticsMetrics?.incrementCounter('render_errors_total', 1, {
    error_type: errorType,
  })

  throw e
}
```

### Unified Cache Metrics

Create a reusable function for consistent cache tracking across the app.

**render-to-string implementation:** [`node/utils/metrics.ts`](https://github.com/vtex/render-to-string/blob/master/node/utils/metrics.ts)

```typescript
export function recordCacheMetric(
  cacheName: string,
  state: 'hit' | 'miss' | 'bypass'
): void {
  global.diagnosticsMetrics?.incrementCounter('cache_operations_total', 1, {
    cache: cacheName,
    cache_state: state,
  })
}
```

---

## Best Practices for Metrics Design

These best practices are based on OpenTelemetry guidelines and the DiagnosticsMetrics API design. They have been validated in production through apps like render-to-string.

### 1. Use a Single Histogram with Attributes

**Don't:** Create separate histograms for each operation
```typescript
// ❌ Bad - creates cardinality explosion
global.diagnosticsMetrics.recordLatency(elapsed, { operation: 'fetch-user-123' })
```

**Do:** Use consistent operation names with attributes
```typescript
// ✅ Good - low cardinality
global.diagnosticsMetrics.recordLatency(elapsed, { 
  operation: 'fetch-user',
  status: 'success'
})
```

### 2. Maintain Backward Compatibility

**Do:** Emit to both APIs during migration
```typescript
// ✅ Emit to both during migration
metrics.batchMetric(name, timeMs, { account, workspace, status })
global.diagnosticsMetrics?.recordLatency(elapsed, { operation: name, status })
```

### 3. Use Optional Chaining for Safety

**Do:** Handle uninitialized state gracefully
```typescript
// ✅ Safe - won't crash if not initialized
global.diagnosticsMetrics?.recordLatency(elapsed, attributes)
```

### 4. Keep Attributes Low Cardinality

**Don't:**
```typescript
// ❌ Millions of unique values
{ user_id: '12345', request_id: 'abc-123' }
```

**Do:**
```typescript
// ✅ Limited set of values
{ endpoint: '/users', status: 'success', region: 'us-east' }
```

### 5. Limit to 5 Attributes Maximum

```typescript
// ✅ Good - 5 attributes
global.diagnosticsMetrics.recordLatency(elapsed, {
  operation: 'api-call',
  status: 'success',
  endpoint: '/users',
  region: 'us-east',
  cache: 'hit'
})

// ❌ Too many - extra will be dropped
global.diagnosticsMetrics.recordLatency(elapsed, {
  attr1: 'val1', attr2: 'val2', attr3: 'val3',
  attr4: 'val4', attr5: 'val5', attr6: 'val6', // Dropped!
  attr7: 'val7'  // Dropped!
})
```

### 6. Follow Naming Conventions

| Metric Type | Pattern | Example |
|-------------|---------|---------|
| Histogram | `{component}_{measurement}_duration_ms` | `http_client_request_duration_ms` |
| Counter | `{component}_{event}_total` | `http_requests_total` |
| Gauge | `{component}_{measurement}_current` | `cache_items_current` |

### 7. Include Context in Logs

```typescript
// ✅ Good - traceable logs
logger.info({
  message: 'operation-name',
  operationId,    // Correlation ID
  timeMs,         // Duration
  ...extraAttributes
})
```

---

## Troubleshooting

### Problem: `diagnosticsMetrics is undefined`

**Cause:** Accessing `global.diagnosticsMetrics` before service initialization.

**Solution:** Add a check:
```typescript
if (!global.diagnosticsMetrics) {
  console.warn('DiagnosticsMetrics not initialized')
  return
}

global.diagnosticsMetrics.recordLatency(...)
```

Or use optional chaining:
```typescript
global.diagnosticsMetrics?.recordLatency(...)
```

### Problem: Metrics not appearing in dashboards

**Checklist:**
1. ✅ Verify `@vtex/api` version is up to date
2. ✅ Check `DIAGNOSTICS_TELEMETRY_ENABLED` environment variable is set
3. ✅ Ensure operation names are consistent (no typos)
4. ✅ Verify attributes have low cardinality (avoid unique IDs)
5. ✅ Check observability backend for metric ingestion

### Problem: High cardinality warnings

**Cause:** Too many unique attribute combinations.

**Solution:** Normalize attribute values to a limited set:
```typescript
// ❌ Bad
{ user_id: userId }

// ✅ Good
{ user_type: 'premium' }  // or 'standard', 'guest'
```

### Problem: More than 5 attributes warning

**Solution:** Reduce to most important attributes. The library will truncate to 5.

---

## FAQ

### Q: Do I need to migrate immediately?

**A:** No. The legacy `MetricsAccumulator` API continues to work. Both APIs coexist independently. Migrate at your own pace.

### Q: Can I use both APIs in the same app?

**A:** Yes! Both `global.metrics` (legacy) and `global.diagnosticsMetrics` (new) are available. You can migrate gradually.

### Q: What happens to my existing dashboards?

**A:** Legacy metrics continue to be exported. New metrics have different names and use attributes. You'll need to update dashboards when you migrate.

### Q: How do I know which metric names to use?

**A:** Follow these conventions:
- Histograms: `{component}_{measurement}_duration_ms` (e.g., `http_client_request_duration_ms`)
- Counters: `{component}_{event}_total` (e.g., `http_requests_total`)
- Gauges: `{component}_{measurement}_current` (e.g., `cache_items_current`)

### Q: What about the `metric:` parameter in HTTP client config?

**A:** It continues to work! The HTTP client was updated internally to use `DiagnosticsMetrics` while maintaining backward compatibility.

### Q: Should I remove `MetricsAccumulator` imports?

**A:** Not required, but recommended for new code. For existing code, migrate when you touch that code.

### Q: What's the performance impact?

**A:** The new API has lower overhead (<500ns per recording) and uses less memory (no in-memory aggregation).

---

## Additional Resources

- [Metrics Catalog](./METRICS_CATALOG.md) - Complete list of all available metrics
- [VTEX IO Documentation](https://developers.vtex.com/docs/guides/vtex-io-documentation-what-is-vtex-io)

## Support

If you need help with migration:
- Check the [Troubleshooting](#troubleshooting) section
- Review the [production examples](#additional-examples-from-production-apps)
- Open an issue in the node-vtex-api repository
