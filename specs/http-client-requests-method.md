# HTTP client request method on `http_client_requests_total`

> **Status**: Done
> **Created**: 2026-10-27
> **Jira**: [XTNSNS-2594](https://vtex-dev.atlassian.net/browse/XTNSNS-2594) (subtask of [XTNSNS-2507](https://vtex-dev.atlassian.net/browse/XTNSNS-2507), epic [XTNSNS-1311](https://vtex-dev.atlassian.net/browse/XTNSNS-1311))
> **Repository**: [vtex/node-vtex-api](https://github.com/vtex/node-vtex-api)

## 1. Business Context

### Problem Statement

[XTNSNS-2507](https://vtex-dev.atlassian.net/browse/XTNSNS-2507) reports five Query metrics failures on the o11y Read API. Four of them are Read API bugs (aggregated `BETWEEN`, `avg(Value)`, `min`/`max`, and `meta.pagination.total`). The fifth is not: `Attributes['method']` on `http_client_requests_total` comes back as an empty string.

The Read API only reads the attribute map already stored in ClickHouse (`telemetry.metrics_distributed`). For this metric the stored keys are `client_metric`, `component`, `otel.metric.overflow`, `route_id`, `route_type`, `status`, `status_code`, and `vtex.account.name`. `method` is absent, so `arrayElement(Attributes, 'method')` returns `""`. The same query returns `GET` and `POST` when a local simulation writes the key. `diagnostics-nodejs` only forwards the map the emitter sends.

The counter is emitted by `@vtex/api` in `metricsMiddleware`. Consumers of Query metrics cannot group or filter outbound HTTP calls by verb. `status_code` on the same rows is populated, which shows the pipeline is fine and the attribute was never recorded.

### Goals

- After a deploy of `node-vtex-api`, new samples of `http_client_requests_total` include `method` with the verb of the outbound call (`get`, `post`, `put`, `patch`, `delete`, `head`).
- A Query metrics request that selects `Attributes['method']` for that metric returns those verbs instead of empty strings.
- Rows written before the deploy stay unchanged. They keep returning an empty string because the key was never stored.

### User Stories

#### US-1: Read the outbound verb from Query metrics

- **Story**: As a consumer of the o11y Query metrics API, I want `Attributes['method']` on `http_client_requests_total` to be the outbound HTTP verb, so that I can filter and group client calls the same way I already filter `Attributes['status_code']`.
- **Acceptance Criteria**:
  - **Given** an app using a published `@vtex/api` that includes this change, **when** that app makes an outbound call with `config.metric` set and `config.method` equal to `post`, **then** the emitted `http_client_requests_total` sample carries `method=post`.
  - **Given** samples emitted after the deploy are in `telemetry.metrics_distributed`, **when** Query metrics selects `Attributes['method']` filtered to `MetricName = http_client_requests_total` over that window, **then** the column contains the outbound verbs and not an empty string.
  - **Given** samples emitted before the deploy, **when** the same query reads them, **then** `Attributes['method']` is still empty and no backfill is attempted.

#### US-2: Keep the inbound verb out of the client counter

- **Story**: As an operator looking at client metrics, I want `method` to describe the call the app made, so that a handler that received `GET` and then called another service with `POST` is not reported as `GET`.
- **Acceptance Criteria**:
  - **Given** an inbound request whose route method is `GET` and an outbound `HttpClient` call whose `config.method` is `post`, **when** `http_client_requests_total` is recorded, **then** `method` is `post`.
  - **Given** the inbound timings middleware, **when** it sets base attributes for the handler, **then** it does not set `method`.

### Key Scenarios

| Scenario | Pre-conditions | Steps | Expected Result |
|---|---|---|---|
| Happy path: outbound POST is labeled | `config.metric` is set, `config.method` is `post`, diagnostics metrics are enabled | The client middleware finishes the call and increments `http_client_requests_total` | Attributes include `method: "post"` together with `client_metric`, `status_code`, and `status` |
| Error case: failed call still records the verb | `config.metric` is set, `config.method` is `put`, the outbound call rejects with HTTP 500 | The middleware records status in `finally` and rethrows | `http_client_requests_total` is incremented once with `status: "error"` and `method: "put"` |
| Edge case: `get` never sets `method` | `HttpClient.get` is used, so `config.method` is omitted, `config.metric` is set | The middleware builds attributes after the call | `method` is `get`, matching the tracing tag fallback. The attribute is not omitted and not `""` |
| Edge case: historical rows | Query window includes samples from before the deploy | Query metrics selects `Attributes['method']` | Pre-change rows still return `""`. Post-change rows return the verb. No schema migration |
| Edge case: inbound and outbound verbs differ | Handler base attributes are `component=http-handler` plus `route_id` and `route_type`. The client call method is `post` | Diagnostics merges base attributes over custom attributes | `method=post` survives the merge. `component` stays `http-handler` because that key already exists on the inbound base map |

### Functional Requirements

1. `metricsMiddleware` adds `method` to the diagnostics attribute map used by `http_client_requests_total`.
2. The value is the outbound method on `ctx.config.method`. When that value is missing or empty, the recorded value is `get`.
3. The value is stored as it is on the client config. `HttpClient` sets lowercase verbs (`post`, `put`, `patch`, `head`, `delete`). This change does not uppercase them. The `GET` / `POST` strings in the local simulation are an artifact of that simulation writing the key, not the production format.
4. `method` is not added in `src/service/worker/runtime/http/middlewares/timings.ts`.
5. Metrics are still emitted only when `ctx.config.metric` is set. This change does not start emitting the counter for unlabeled calls.
6. Unit tests in `src/HttpClient/middlewares/metrics.test.ts` assert the new attribute on `http_client_requests_total`, including the missing-method fallback.
7. `docs/METRICS_CATALOG.md` lists `method` on `http_client_requests_total`.

### Non-Functional Requirements

- No new network calls, instruments, or label allow-lists. One string attribute on an existing counter.
- Cardinality stays bounded. Callers already pass a small set of HTTP verbs. The attribute must not carry URL, host, or route.
- The custom attribute map must stay within `MAX_CUSTOM_ATTRIBUTES` (7) in `src/metrics/DiagnosticsMetrics.ts`. `limitCustomAttributes` keeps the first seven entries and drops the rest. Today the client map has five keys. Adding `method` makes six on the request counter, and seven where `cache_state` or `retry_count` is also set. `method` has to be part of that object, not an eighth key.
- Publishing and rolling out `@vtex/api` is required before production queries change. The Read API does not need a deploy for this symptom.

### Out of Scope

- The other four symptoms of XTNSNS-2507, owned by the Read API subtasks:
  - [XTNSNS-2590](https://vtex-dev.atlassian.net/browse/XTNSNS-2590) — `BETWEEN` on aggregated `Count`, `Sum`, and `Value` (`HAVING` instead of `WHERE`)
  - [XTNSNS-2591](https://vtex-dev.atlassian.net/browse/XTNSNS-2591) — `meta.pagination.total` counted after `GROUP BY`
  - [XTNSNS-2592](https://vtex-dev.atlassian.net/browse/XTNSNS-2592) — `avg(Value)` chosen from `MetricType`
  - [XTNSNS-2593](https://vtex-dev.atlassian.net/browse/XTNSNS-2593) — `min` and `max` plus the histogram schema migration
- Backfill or rewrite of ClickHouse rows written before the deploy.
- Adding `method` to inbound handler metrics (`http_handler_requests_total` and the `http_server_*` counters).
- Changing attribute merge precedence in `DiagnosticsMetrics`.
- Grafana plugin work under epic XTNSNS-1311.

---

## 2. Arch Decisions

### Proposed Solution

Record the outbound verb where the counter is created. In `src/HttpClient/middlewares/metrics.ts`, extend the existing `baseAttributes` object passed to `incrementCounter('http_client_requests_total', ...)` with `method`.

`ctx.config.method` is already the value tracing stores as `http.method` in `src/HttpClient/middlewares/request/index.ts` (`config.method || 'get'`). `HttpClient.put`, `post`, `patch`, `head`, and `delete` set that field. `HttpClient.get` and `getRaw` do not, and axios treats a missing method as `get`. The metric uses the same fallback so a normal GET is not stored as a missing key.

`timings.ts` installs inbound base attributes (`vtex.account.name`, `component: http-handler`, `route_id`, `route_type`) through `runWithBaseAttributes`. `DiagnosticsMetrics.mergeAttributes` keeps those keys and drops custom attributes with the same name. That is why production rows show `component: http-handler` next to `client_metric`. `method` is not one of those keys, so a `method` set on the client map is kept. Putting `method` on the inbound map would label the client counter with the request that entered the app.

```mermaid
sequenceDiagram
  participant App as IO app handler
  participant Timings as timings.ts
  participant Client as HttpClient metricsMiddleware
  participant Diag as DiagnosticsMetrics
  participant CH as ClickHouse metrics_distributed
  participant API as o11y Read API

  App->>Timings: inbound request
  Timings->>Diag: runWithBaseAttributes(account, component=http-handler, route_id, route_type)
  App->>Client: outbound call (config.method, config.metric)
  Client->>Diag: incrementCounter(http_client_requests_total, baseAttributes + method)
  Note over Diag: base keys win on conflict; method is new, so it is kept
  Diag->>CH: attribute map includes method
  API->>CH: Attributes['method']
  CH-->>API: get / post / put / ... for rows written after deploy
```

### Architecture Overview

`@vtex/api` is the VTEX IO Node service runtime and HTTP client. Outbound calls go through `HttpClient`, whose middleware chain records legacy `MetricsAccumulator` batches and diagnostics counters. `metricsMiddleware` runs outside the request middleware and records in a `finally` block, so the verb is captured for successes and failures.

`DiagnosticsMetrics` forwards the merged attribute map to `@vtex/diagnostics-nodejs`. That library does not invent attributes. The o11y Read API projects `Attributes['method']` from the map in ClickHouse. Fixing the emitter is sufficient for this symptom.

`baseAttributes` is also spread into `recordLatency`, `http_client_cache_total`, and `http_client_requests_retried_total`. Those instruments pick up `method` as a consequence of sharing the map. The bug report and the acceptance check are specifically `http_client_requests_total`.

### Alternatives Considered

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| Add `method` on the client `baseAttributes` in `metrics.ts` | Uses the outbound verb. Survives the inbound merge. One map feeds the counter the API queries | Latency, cache, and retry instruments that share the map also gain the attribute | Accepted |
| Add `method` in `timings.ts` | Would show up on every metric inside the request | Records the inbound verb, not the outbound call. Collides with the purpose of the client counter | Rejected |
| Derive `method` in the Read API | No library release | The key is not in ClickHouse. The API cannot recover a verb that was never written. Local simulation only works when the writer supplies it | Rejected |
| Backfill old rows | Historical dashboards would stop showing empty strings | The raw table retention is short and the distributed table has no source value to reconstruct | Rejected |

### Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| `method` becomes the 8th custom attribute and `limitCustomAttributes` drops it or drops `cache_state` / `retry_count` | The API still shows an empty method, or an existing attribute disappears | Low | Add only this key. The request counter goes from 5 to 6 custom attributes. Latency, cache, and retry go to 7, which is the cap |
| `HttpClient.get` leaves `config.method` unset and the key is omitted again | Most client traffic is GET and would still look empty | High if the fallback is skipped | Use `ctx.config.method \|\| 'get'`, the same fallback tracing already uses |
| High-cardinality method strings from a caller | Extra series in ClickHouse | Low | Pass the config value through. Do not append URL or target. Verbs are a closed, small set in `HttpClient` |
| Operators expect uppercase `GET` because the simulation wrote `GET` | Queries that filter `method = GET` miss production rows | Medium | Document the stored form as the lowercase config value. Do not transform case |
| Apps stay on an older `@vtex/api` | Production queries stay empty for those apps | High until rollout | Acceptance is defined after the `node-vtex-api` deploy. This repo does not migrate consumers |

### Key Decisions

#### Decision 1: Record `method` on the client attribute map

- **Status**: Accepted
- **Context**: The Read API returns empty `Attributes['method']` because the emitter never writes the key. Tracing already reads `ctx.config.method`.
- **Decision**: Set `method` from `ctx.config.method` when building `baseAttributes` in `metricsMiddleware`. If the value is missing or empty, use `get`.
- **Consequences**: New samples of `http_client_requests_total` carry the outbound verb. Instruments that share `baseAttributes` carry it too. Old samples are left as they are.

#### Decision 2: Do not set `method` on the inbound timings map

- **Status**: Accepted
- **Context**: Inbound base attributes override custom attributes on key conflict. Production already shows `component: http-handler` on client rows for that reason.
- **Decision**: Leave `timings.ts` unchanged. `method` is only meaningful here as the outbound verb, and it is not a key on the inbound map, so the client value is preserved.
- **Consequences**: A handler `GET` that performs a client `POST` is reported as `post` on `http_client_requests_total`.

#### Decision 3: Catalog the shared map, require the counter the API reads

- **Status**: Accepted
- **Context**: XTNSNS-2594 asks to update the `http_client_requests_total` row in `docs/METRICS_CATALOG.md`. The implementation puts `method` on the shared `baseAttributes`, so the latency histogram, `http_client_cache_total`, and `http_client_requests_retried_total` receive it as well.
- **Decision**: Update the `http_client_requests_total` row, and update the three sibling rows in the same HTTP Client Metrics table so the catalog matches the map.
- **Consequences**: Docs stay aligned with emission. No extra runtime behavior beyond Decision 1.

### Implementation Plan

1. In `src/HttpClient/middlewares/metrics.ts`, add `method` to `baseAttributes` using `ctx.config.method || 'get'`.
2. Extend `src/HttpClient/middlewares/metrics.test.ts` so the `http_client_requests_total` assertion expects `method`, and add a case where `config.method` is omitted and the recorded value is `get`.
3. Update the HTTP Client Metrics attribute lists in `docs/METRICS_CATALOG.md`.
4. Run the metrics middleware unit tests. Runtime verification in Query metrics happens after `@vtex/api` is published and apps pick it up; that check is outside this change.

---

## 3. Technical Contract

### Data Models

Attribute map for diagnostics metrics recorded by `metricsMiddleware` when `ctx.config.metric` is set and `global.diagnosticsMetrics` is present.

| Attribute | Source | On `http_client_requests_total` |
|---|---|---|
| `vtex.account.name` | `ctx.config.headers` account, or `unknown` | existing |
| `component` | `'http-client'` at emission. Replaced by inbound `http-handler` when timings base attributes are active | existing |
| `client_metric` | `ctx.config.metric` | existing |
| `status_code` | response status, or the error response status | existing |
| `status` | `statusLabel` result, or `aborted`, `timeout`, `cancelled`, `error` | existing |
| `method` | `ctx.config.method` when non-empty, otherwise `get` | added |

`method` values written by this library are the lowercase strings `get`, `post`, `put`, `patch`, `delete`, and `head`. A caller that sets `config.method` to another non-empty string is recorded as that string.

Shared-map effect:

| Instrument | Extra attributes beyond the map | `method` after this change |
|---|---|---|
| `http_client_requests_total` | none | yes |
| latency histogram (`recordLatency`) | `cache_state` | yes |
| `http_client_cache_total` | `cache_state` | yes, when `cache_state !== 'none'` |
| `http_client_requests_retried_total` | `retry_count` | yes, when `retryCount > 0` |

### Interfaces

Emission, inside `metricsMiddleware`:

```ts
const baseAttributes: Attributes = {
  [AttributeKeys.VTEX_ACCOUNT_NAME]: account,
  component: 'http-client',
  client_metric: ctx.config.metric,
  status_code: rawStatusCode,
  status,
  method: ctx.config.method || 'get',
}

global.diagnosticsMetrics.incrementCounter('http_client_requests_total', 1, baseAttributes)
```

Read contract, unchanged and not implemented here. Query metrics over `http_client_requests_total` exposes the stored map as `Attributes['method']` (`arrayElement(Attributes, 'method')`). A missing key stays `""`. A key written by this change returns the verb.

### Integration Points

- `src/HttpClient/middlewares/metrics.ts` writes the attribute. `src/HttpClient/HttpClient.ts` is the caller that sets `method` for every verb except GET.
- `src/HttpClient/middlewares/request/index.ts` is the existing reader of `ctx.config.method` for the tracing tag. This change does not alter that middleware. The fallback string matches it.
- `src/service/worker/runtime/http/middlewares/timings.ts` supplies inbound base attributes that override conflicting client keys. It stays unchanged.
- `src/metrics/DiagnosticsMetrics.ts` merges and caps custom attributes. It stays unchanged.
- `@vtex/diagnostics-nodejs` transports the map. The o11y Read API and ClickHouse are downstream. They are not modified by this spec.

### Invariants & Constraints

- `http_client_requests_total` is incremented only when `ctx.config.metric` is set and diagnostics metrics are available. Legacy `metrics.batch` behavior is unchanged.
- `method` on this counter is the outbound verb. It is never taken from the inbound route.
- `method` is never `""`. A missing config value is recorded as `get`.
- Case is not normalized. The recorded string is the config value, or `get`.
- Adding `method` does not push any of these `incrementCounter` / `recordLatency` calls past seven custom attributes.
- Samples written before the emitting process runs this code do not gain the key.
