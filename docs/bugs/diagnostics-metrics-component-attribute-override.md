# Bug: `component` attribute silently overridden across nested `DiagnosticsMetrics` scopes

**Status:** Confirmed via production data. Not yet fixed. This document is the input for a future spec/change on both `master` (7.x) and `6.x`.

**Affects:** `node-vtex-api`, both `master` and `6.x` — the `6.x` code was ported verbatim from `master` during the diagnostics-metrics backport (PRs #710/#711), so this is inherited, pre-existing behavior, not something the backport introduced.

## Summary

Every outbound HTTP client call made while handling an inbound request gets mislabeled with `component: 'http-handler'` in the shared `io_app_operation_duration_milliseconds` histogram, instead of its correct `component: 'http-client'`. This happens because `DiagnosticsMetrics`'s base-attribute merge rule ("base attributes take precedence over conflicting custom attributes") silently overrides the nested call's own `component` value with whatever the enclosing request scope set, whenever both use the same attribute key.

The bug is invisible in code review because each call site looks correct in isolation — it only manifests from the *interaction* between two call sites, one nested inside the other's `runWithBaseAttributes` scope.

## How it was found

While validating the `6.x` diagnostics-metrics backport in the `iotest-ju2`/production ClickHouse data, we cross-checked `http_handler_requests_total` (a counter, incremented once per completed request) against `io_app_operation_duration_milliseconds` (a shared histogram used for *all* latency recordings, filtered to `Attributes['component'] = 'http-handler'`) for the same app/cluster/time window, expecting them to closely match since both are recorded from the same code path in `timings.ts`.

Query (against `vtex.search-resolver@1.114.0`, cluster `iostore-f3t`, 1-hour window):

```sql
SELECT app, MetricName, MetricType,
       sumMerge(Sum) AS sum_value, sumMerge(Count) AS total_count
FROM telemetry.metrics_distributed
WHERE clusterId = 'iostore-f3t'
AND app = 'vtex.search-resolver@1.114.0'
AND ((MetricName = 'http_handler_requests_total')
     OR (MetricName = 'io_app_operation_duration_milliseconds' AND Attributes['component'] = 'http-handler'))
AND TimestampTime >= now() - INTERVAL 1 HOUR
GROUP BY app, MetricName, MetricType
ORDER BY MetricName
```

Result:

| MetricName | MetricType | total_count |
|---|---|---|
| `http_handler_requests_total` | counter | 72,587 |
| `io_app_operation_duration_milliseconds` (`component='http-handler'`) | histogram | 16,104,556 |

A ~222x mismatch. `search-resolver` is a federated GraphQL resolver that fans out to many backend services per incoming request, which is consistent with a large multiplier if every one of those fan-out calls' latency is being folded into the `http-handler` bucket instead of `http-client`.

**Not yet run, but should be run to fully close the loop:**

```sql
SELECT Attributes['component'] AS component, sumMerge(Count) AS total_count
FROM telemetry.metrics_distributed
WHERE clusterId = 'iostore-f3t'
AND app = 'vtex.search-resolver@1.114.0'
AND MetricName = 'io_app_operation_duration_milliseconds'
AND TimestampTime >= now() - INTERVAL 1 HOUR
GROUP BY Attributes['component']
```

Expected (if the bug is real): only `http-handler` appears, even though `http_client_requests_total` for the same app/window shows outbound calls are happening — i.e. every client-call latency observation is being swallowed under the handler label, and `http-client` never appears in the histogram's attribute distribution at all.

## Root cause

Two independent pieces of code interact badly:

**1. `DiagnosticsMetrics.mergeAttributes` gives base attributes precedence over custom attributes on key conflict** (`src/metrics/DiagnosticsMetrics.ts`, both branches):

```ts
private mergeAttributes(customAttributes?: Attributes): Attributes | undefined {
  const baseAttributes = this.getBaseAttributes()
  const limitedCustomAttributes = limitCustomAttributes(customAttributes)
  // ...
  // Filter out custom attributes that conflict with base attributes (base takes precedence)
  const baseKeys = new Set(Object.keys(baseAttributes))
  const nonConflictingCustomAttributes: Attributes = {}
  for (const [key, value] of Object.entries(limitedCustomAttributes)) {
    if (!baseKeys.has(key)) {
      nonConflictingCustomAttributes[key] = value
    }
    // Silently drop conflicting custom attributes - base attributes take precedence
  }
  return { ...baseAttributes, ...nonConflictingCustomAttributes }
}
```

This is intentional, documented behavior (see the class's own docstring: *"Base attributes take precedence over custom attributes. If a custom attribute has the same key as a base attribute, the custom attribute is silently dropped."*). It exists so request-scoped context (account, route, etc.) reliably survives into every metric call made during that request, without callers having to thread it through manually.

**2. `timings.ts` sets `component: 'http-handler'` as a *base* attribute for the entire request scope**, including everything the handler does while it runs (`src/service/worker/runtime/http/middlewares/timings.ts`, both branches):

```ts
const baseAttributes: Attributes = {
  [AttributeKeys.VTEX_ACCOUNT_NAME]: vtex.account,
  component: 'http-handler',
  route_id: id,
  route_type: type,
}
// ...
await global.diagnosticsMetrics.runWithBaseAttributes(baseAttributes, executeWithBaseAttributes)
```

`executeWithBaseAttributes` calls `next()`, which runs the full handler — including any outbound HTTP calls the handler makes.

**3. `HttpClient/middlewares/metrics.ts` sets its own `component: 'http-client'` as a *custom* attribute** on the same shared histogram (`src/HttpClient/middlewares/metrics.ts`, both branches):

```ts
const baseAttributes: Attributes = {
  [AttributeKeys.VTEX_ACCOUNT_NAME]: account,
  component: 'http-client',
  client_metric: ctx.config.metric,
  status_code: rawStatusCode,
  status,
}
global.diagnosticsMetrics.recordLatency(elapsed, { ...baseAttributes, cache_state: cacheState })
```

(Note: this file's own local variable is *also* named `baseAttributes`, but from `DiagnosticsMetrics`'s point of view it's the *custom* attributes argument to `recordLatency` — the naming collision between the two files' local variable names is a minor readability trap on top of the real bug.)

When this call happens during handling of a request (i.e. inside `timings.ts`'s `runWithBaseAttributes` scope), rule #1 fires: the outer scope's `component: 'http-handler'` wins, and the inner call's `component: 'http-client'` is silently dropped. The client-call latency observation still gets recorded — just under the wrong label.

The same failure mode applies to any other attribute key that both an outer request scope and an inner nested call happen to set — `component` is the one we've found evidence of via production data, but it's worth auditing for others (e.g. `status`/`status_code` are also set by both `timings.ts` and `metrics.ts`, though those are less likely to actually diverge in value between outer/inner scope, they're the same shape of risk).

## Impact

- **Metric mislabeling, not data loss.** Every affected data point is still recorded, with the correct latency value — just tagged with the wrong `component`.
- **Any dashboard/alert that filters or breaks down `io_app_operation_duration_milliseconds` by `component`** is showing wrong numbers: `http-handler`'s bucket is inflated by however many nested calls happen per request, and `http-client`'s bucket (when observed inside a request scope, which is the common case) is essentially never populated.
- **Counters are unaffected.** `http_handler_requests_total`, `http_client_requests_total`, `http_server_requests_total`, etc. are separate metric names with their own dedicated `incrementCounter` calls — those aren't subject to this specific collision because they don't share a name across the two call sites the way the single shared latency histogram does. (`http_client_requests_total`'s own attributes could still be susceptible to the same base-vs-custom precedence issue independently, if any of *its* attribute keys also collide with an outer base attribute — worth checking as part of the fix.)
- **Reproducible on `master` today**, independent of anything in the `6.x` backport — this is not a regression, it's a latent bug that's been live in production since `component`-based attribution was added to both call sites.

## Directions to consider for the fix (not decided — for the future spec to work out)

- Give nested `recordLatency`/`incrementCounter`/`setGauge` calls a way to say "this custom attribute must win even over a base attribute" (e.g. a per-call override flag, or a dedicated non-overridable attribute namespace).
- Don't let `timings.ts` set `component` as a *base* attribute at all — record the handler's own latency with `component: 'http-handler'` as a plain custom attribute on its own `recordLatency` call (matching what `metrics.ts` already does), and reserve `runWithBaseAttributes` for values that should never vary within a request (account, route id/type) rather than a value describing which single call this is.
- Rename one side's key (e.g. `metrics.ts` emits `client_component` instead of `component`) so the two concepts don't collide at all — cheapest fix, but doesn't address the general "any two colliding keys silently mismerge" risk for future call sites.
- Reconsider whether "base always wins" is the right default at all, versus "innermost caller wins" (which is more how most tracing/logging context libraries behave) — this is the most invasive option since it changes documented, intentional behavior other call sites may already depend on.

## Where this needs to land

Both `master` and `6.x` need the same fix, since both currently have identical `timings.ts`/`metrics.ts`/`DiagnosticsMetrics.ts` code. Whatever spec comes out of this should cover both branches, likely as two coordinated changes (or one change with parallel tasks per branch, mirroring how the original diagnostics-metrics backport was structured).
