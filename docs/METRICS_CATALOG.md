# Metrics Catalog for VTEX IO Node Apps

This document provides a comprehensive catalog of all metrics available in the `@vtex/api` library, organized by their implementation (diagnostics-based vs legacy).

> **Looking for migration guidance?** See [METRICS_OVERVIEW.md](./METRICS_OVERVIEW.md) for migration patterns and best practices.

## Table of Contents

- [Metrics Architecture Overview](#metrics-architecture-overview)
- [Complete Metrics Visual Summary](#complete-metrics-visual-summary)
- [Diagnostics-Related Metrics](#diagnostics-related-metrics)
- [Legacy Metrics (Non-Diagnostics)](#legacy-metrics-non-diagnostics)

---

## Metrics Architecture Overview

The `@vtex/api` library has two coexisting metrics systems during the migration period:

1. **Diagnostics-Based Metrics** (New) - Uses `@vtex/diagnostics-nodejs` with OpenTelemetry
2. **Legacy Metrics** (Existing) - Uses `prom-client`, in-memory `MetricsAccumulator`, and `__VTEX_IO_BILLING` console.log exports

Both systems operate independently and can coexist. The goal is to gradually migrate to diagnostics-based metrics while maintaining backward compatibility.

### Two Categories of Metrics

| Category | Description | Initialization | Customization |
|----------|-------------|----------------|---------------|
| **Runtime/Infrastructure** | System-wide metrics for capacity planning and SLOs | Once at startup | Limited (configured at startup) |
| **App/Middleware** | Operation-specific metrics for debugging and optimization | Per-request/operation | Rich (can add custom attributes) |

---

## Complete Metrics Visual Summary

```
All Metrics in node-vtex-api
│
├── 🆕 Diagnostics-Related Metrics (OpenTelemetry-based)
│   │
│   ├── 🏗️ Runtime/Infrastructure Metrics
│   │   │
│   │   ├── OTel Request Instruments (service/metrics/metrics.ts)
│   │   │   ├── io_http_requests_current (Gauge)
│   │   │   ├── runtime_http_requests_duration_milliseconds (Histogram)
│   │   │   ├── runtime_http_requests_total (Counter)
│   │   │   ├── runtime_http_response_size_bytes (Histogram)
│   │   │   └── runtime_http_aborted_requests_total (Counter)
│   │   │
│   │   ├── Auto-instrumentation (telemetry/client.ts)
│   │   │   ├── http.server.duration (Histogram - HttpInstrumentation)
│   │   │   ├── http.server.request.size (Histogram)
│   │   │   ├── http.server.response.size (Histogram)
│   │   │   ├── http.client.duration (Histogram - HttpInstrumentation)
│   │   │   ├── http.client.request.size (Histogram)
│   │   │   ├── http.client.response.size (Histogram)
│   │   │   └── Koa-enhanced HTTP metrics (KoaInstrumentation)
│   │   │
│   │   └── Host Metrics (HostMetricsInstrumentation)
│   │       ├── process.runtime.nodejs.memory.heap.used (Gauge)
│   │       ├── process.runtime.nodejs.memory.heap.total (Gauge)
│   │       ├── process.runtime.nodejs.memory.rss (Gauge)
│   │       ├── process.runtime.nodejs.memory.external (Gauge)
│   │       ├── process.runtime.nodejs.memory.arrayBuffers (Gauge)
│   │       ├── process.runtime.nodejs.event_loop.lag.max (Gauge)
│   │       ├── process.runtime.nodejs.event_loop.lag.min (Gauge)
│   │       ├── process.cpu.utilization (Gauge)
│   │       ├── system.cpu.utilization (Gauge)
│   │       ├── system.memory.usage (Gauge)
│   │       ├── system.memory.utilization (Gauge)
│   │       ├── system.network.io (Counter)
│   │       └── system.network.errors (Counter)
│   │
│   └── 📱 App/Middleware Metrics
│       │
│       ├── HTTP Client (HttpClient/middlewares/metrics.ts)
│       │   ├── latency histogram (via recordLatency)
│       │   ├── http_client_requests_total (Counter)
│       │   ├── http_client_cache_total (Counter)
│       │   └── http_client_requests_retried_total (Counter)
│       │
│       ├── HTTP Handler (worker/runtime/http/middlewares/*)
│       │   ├── latency histogram (via recordLatency)
│       │   ├── http_handler_requests_total (Counter)
│       │   ├── http_server_requests_total (Counter)
│       │   ├── http_server_requests_closed_total (Counter)
│       │   └── http_server_requests_aborted_total (Counter)
│       │
│       ├── GraphQL (worker/runtime/graphql/schema/schemaDirectives/Metric.ts)
│       │   ├── latency histogram (via recordLatency)
│       │   └── graphql_field_requests_total (Counter)
│       │
│       └── HTTP Agent (HttpClient/middlewares/request/HttpAgentSingleton.ts)
│           ├── http_agent_sockets_current (Gauge)
│           ├── http_agent_free_sockets_current (Gauge)
│           └── http_agent_pending_requests_current (Gauge)
│
└── 🏛️ Legacy Metrics (Non-Diagnostics)
    │
    ├── 📊 Prometheus Metrics (prom-client, exposed on /metrics)
    │   │
    │   ├── Request Metrics (service/tracing/metrics/*)
    │   │   ├── runtime_http_requests_total (Counter) - labels: status_code, handler
    │   │   ├── runtime_http_aborted_requests_total (Counter) - labels: handler
    │   │   ├── runtime_http_requests_duration_milliseconds (Histogram)
    │   │   ├── runtime_http_response_size_bytes (Histogram)
    │   │   └── io_http_requests_current (Gauge)
    │   │
    │   ├── Event Loop Metrics (service/tracing/metrics/measurers/*)
    │   │   ├── runtime_event_loop_lag_max_between_scrapes_seconds (Gauge)
    │   │   └── runtime_event_loop_lag_percentiles_between_scrapes_seconds (Gauge)
    │   │
    │   └── Default Node.js Metrics (collectDefaultMetrics)
    │       ├── nodejs_gc_duration_seconds (Histogram)
    │       ├── nodejs_active_handles_total (Gauge)
    │       ├── nodejs_active_requests_total (Gauge)
    │       ├── nodejs_heap_size_total_bytes (Gauge)
    │       ├── nodejs_heap_size_used_bytes (Gauge)
    │       ├── nodejs_external_memory_bytes (Gauge)
    │       ├── nodejs_version_info (Gauge)
    │       ├── process_cpu_user_seconds_total (Counter)
    │       ├── process_cpu_system_seconds_total (Counter)
    │       ├── process_resident_memory_bytes (Gauge)
    │       └── process_start_time_seconds (Gauge)
    │
    ├── 📝 MetricsAccumulator (in-memory; flushed & discarded on each /_status tick via trackStatus)
    │   │
    │   ├── HTTP Handler Metrics (worker/runtime/http/middlewares/timings.ts)
    │   │   └── http-handler-{route_id}
    │   │       ├── Aggregates: count, mean, median, percentile95, percentile99, max
    │   │       └── Extensions: success, error, timeout, aborted, cancelled
    │   │
    │   ├── HTTP Client Metrics (HttpClient/middlewares/metrics.ts)
    │   │   └── http-client-{metric_name}
    │   │       ├── Aggregates: count, mean, median, percentile95, percentile99, max
    │   │       └── Extensions: 
    │   │           ├── Status: success, error, timeout, aborted, cancelled
    │   │           ├── Cache: success-hit, success-miss, success-inflight, success-memoized
    │   │           └── Retry: retry-{status}-{count}
    │   │
    │   ├── GraphQL Metrics (worker/runtime/graphql/schema/schemaDirectives/Metric.ts)
    │   │   └── graphql-metric-{field_name}
    │   │       ├── Aggregates: count, mean, median, percentile95, percentile99, max
    │   │       └── Extensions: success, error
    │   │
    │   ├── System Metrics (metrics/MetricsAccumulator.ts)
    │   │   ├── cpu - user (μs), system (μs)
    │   │   ├── memory - rss, heapTotal, heapUsed, external, arrayBuffers
    │   │   ├── httpAgent - sockets, freeSockets, pendingRequests
    │   │   └── incomingRequest - total, closed, aborted
    │   │
    │   └── Cache Metrics (via trackCache)
    │       └── {cache_name}-cache
    │           ├── LRU: itemCount, length, disposedItems, hitRate, hits, max, total
    │           ├── Disk: hits, total
    │           └── Multilayer: hitRate, hits, total
    │
    └── 💰 Billing Metrics (console.log with __VTEX_IO_BILLING)
        └── Process time per handler
            ├── account, app, handler
            ├── production, routeType (public_route/private_route)
            ├── timestamp, value (milliseconds)
            └── vendor, workspace
```

---

## Diagnostics-Related Metrics

### Runtime/Infrastructure Metrics

These are system-wide metrics declared at service initialization level.

#### OTel Request Instruments

**Source:** `service/metrics/metrics.ts`

| Metric Name | Type | Description |
|-------------|------|-------------|
| `io_http_requests_current` | Gauge | Current number of requests in progress |
| `runtime_http_requests_duration_milliseconds` | Histogram | Incoming HTTP request duration |
| `runtime_http_requests_total` | Counter | Total number of HTTP requests |
| `runtime_http_response_size_bytes` | Histogram | Outgoing response sizes |
| `runtime_http_aborted_requests_total` | Counter | Total aborted HTTP requests |

#### Auto-instrumentation Metrics

**Source:** `telemetry/client.ts` (via OpenTelemetry instrumentations)

| Metric Name | Type | Source | Description |
|-------------|------|--------|-------------|
| `http.server.duration` | Histogram | HttpInstrumentation | HTTP server request duration |
| `http.client.duration` | Histogram | HttpInstrumentation | HTTP client request duration |
| `process.runtime.nodejs.memory.*` | Gauge | HostMetrics | Node.js memory metrics |
| `process.cpu.utilization` | Gauge | HostMetrics | Process CPU utilization |
| `system.cpu.utilization` | Gauge | HostMetrics | System CPU utilization |
| `system.memory.usage` | Gauge | HostMetrics | System memory usage |

### App/Middleware Metrics

These are operation-specific metrics recorded in middleware components.

#### HTTP Client Metrics

**Source:** `HttpClient/middlewares/metrics.ts`

| Metric Name | Type | Attributes |
|-------------|------|------------|
| Latency histogram | Histogram | `component`, `client_metric`, `status_code`, `status`, `cache_state` |
| `http_client_requests_total` | Counter | `component`, `client_metric`, `status_code`, `status` |
| `http_client_cache_total` | Counter | `component`, `client_metric`, `status_code`, `status`, `cache_state` |
| `http_client_requests_retried_total` | Counter | `component`, `client_metric`, `status_code`, `status`, `retry_count` |

#### HTTP Handler Metrics

**Source:** `worker/runtime/http/middlewares/timings.ts`, `requestStats.ts`

| Metric Name | Type | Attributes |
|-------------|------|------------|
| Latency histogram | Histogram | `component`, `route_id`, `route_type`, `status_code`, `status` |
| `http_handler_requests_total` | Counter | `component`, `route_id`, `route_type`, `status_code`, `status` |
| `http_server_requests_total` | Counter | `route_id`, `route_type`, `status_code` |
| `http_server_requests_closed_total` | Counter | `route_id`, `route_type`, `status_code` |
| `http_server_requests_aborted_total` | Counter | `route_id`, `route_type`, `status_code` |

#### GraphQL Metrics

**Source:** `worker/runtime/graphql/schema/schemaDirectives/Metric.ts`

| Metric Name | Type | Attributes |
|-------------|------|------------|
| Latency histogram | Histogram | `component`, `field_name`, `status` |
| `graphql_field_requests_total` | Counter | `component`, `field_name`, `status` |

#### HTTP Agent Metrics

**Source:** `HttpClient/middlewares/request/HttpAgentSingleton.ts`

| Metric Name | Type | Description |
|-------------|------|-------------|
| `http_agent_sockets_current` | Gauge | Active sockets |
| `http_agent_free_sockets_current` | Gauge | Free sockets in pool |
| `http_agent_pending_requests_current` | Gauge | Pending requests waiting for socket |

---

## Legacy Metrics (Non-Diagnostics)

### Prometheus Metrics

Exposed on the `/metrics` endpoint via `prom-client`.

#### Request Metrics

**Source:** `service/tracing/metrics/MetricNames.ts`

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `runtime_http_requests_total` | Counter | `status_code`, `handler` | Total HTTP requests |
| `runtime_http_aborted_requests_total` | Counter | `handler` | Aborted HTTP requests |
| `runtime_http_requests_duration_milliseconds` | Histogram | `handler` | Request duration (buckets: 10-5120ms) |
| `runtime_http_response_size_bytes` | Histogram | `handler` | Response sizes (buckets: 500B-4MB) |
| `io_http_requests_current` | Gauge | - | Concurrent requests |

#### Event Loop Metrics

**Source:** `service/tracing/metrics/measurers/EventLoopLagMeasurer.ts`

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `runtime_event_loop_lag_max_between_scrapes_seconds` | Gauge | - | Max event loop lag |
| `runtime_event_loop_lag_percentiles_between_scrapes_seconds` | Gauge | `percentile` | Event loop lag percentiles (95, 99) |

#### Default Node.js Metrics

Via `collectDefaultMetrics()` from `prom-client`:

- `nodejs_gc_duration_seconds` - GC duration histogram
- `nodejs_active_handles_total` - Active handles
- `nodejs_active_requests_total` - Active requests
- `nodejs_heap_size_*_bytes` - Heap metrics
- `nodejs_external_memory_bytes` - External memory
- `nodejs_version_info` - Node.js version
- `process_cpu_*_seconds_total` - CPU counters
- `process_resident_memory_bytes` - RSS memory
- `process_start_time_seconds` - Process start time

### MetricsAccumulator

Accumulated in worker memory. On each cluster-wide `/_status` tick, `trackStatus()`
flushes the accumulated batches (via `global.metrics.statusTrack()`) and discards
the result. These values are **no longer exported via `console.log`** (the legacy
`type: metric/status` `__VTEX_IO_LOG` stream has been removed); the flush is kept
only to prevent batched metrics from growing unbounded in memory.

**Source:** `metrics/MetricsAccumulator.ts`

#### Aggregated Metrics Format

Each metric includes:
- `name` - Metric identifier
- `count` - Number of samples
- `mean`, `median` - Average and middle values
- `percentile95`, `percentile99` - Tail latencies
- `max` - Maximum value
- `production` - Environment flag
- Plus any custom extensions

#### System Metrics

| Metric Name | Properties |
|-------------|------------|
| `cpu` | `user` (μs), `system` (μs) |
| `memory` | `rss`, `heapTotal`, `heapUsed`, `external`, `arrayBuffers` |
| `httpAgent` | `sockets`, `freeSockets`, `pendingRequests` |
| `incomingRequest` | `total`, `closed`, `aborted` |

### Billing Metrics

**Source:** `worker/runtime/http/middlewares/timings.ts`

Exported with `__VTEX_IO_BILLING` flag for usage tracking:

```json
{
  "__VTEX_IO_BILLING": "true",
  "account": "...",
  "app": "...",
  "handler": "...",
  "production": true,
  "routeType": "public_route",
  "timestamp": 1234567890,
  "type": "process-time",
  "value": 150,
  "vendor": "vtex",
  "workspace": "master"
}
```

---

## Related Documentation

- [Migration Guide](./METRICS_OVERVIEW.md) - Patterns and best practices for migrating to diagnostics-based metrics

