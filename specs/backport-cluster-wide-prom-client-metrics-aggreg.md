# Spec: Backport cluster-wide prom-client metrics aggregation (plus undefined-handler-label fix) to 6.x

> **Status: ⏳ awaiting approval.** This document describes the planned change.
> Implementation follows in a second phase on the same PR. **Base branch: `6.x`**
> (the maintenance line), NOT `master` (the 7.x line).

---

## Context & problem

VTEX IO runtimes run as a Node.js `cluster`: the master (`src/service/master.ts`)
forks `min(cpus, MAX_WORKERS=4)` workers, each listening on the shared
`HTTP_SERVER_PORT`. Every worker keeps its **own** prom-client default registry
(`register`): the request counters are created per-worker in
`src/service/metrics/requestMetricsMiddleware.ts` (via the
`create*Instrument()` factories in `src/service/tracing/metrics/instruments.ts`),
and `collectDefaultMetrics()` is called per-worker in
`src/service/worker/runtime/builtIn/middlewares.ts`.

`/metrics` is served by `prometheusLoggerMiddleware`
(`src/service/worker/runtime/builtIn/middlewares.ts`), which answers with
`register.metrics()` — i.e. **only the local registry of whichever worker the OS
round-robin handed the scrape connection to**. Because Node's keep-alive socket
timeout (5s) is shorter than the Prometheus scrape interval, almost every scrape
lands on a *different* worker.

Consequence: Prometheus sees, under a single `instance` label, an interleaved
braid of 4 independent monotonic counters. Each time a scrape hits a worker whose
local count is lower than the previously scraped worker's, Prometheus treats the
drop as a **counter reset**, so `rate()` / `increase()` over `runtime_*` counters
(notably `runtime_http_requests_total{handler,status_code}`) are inflated by
orders of magnitude (~×40 measured on a live pod).

This has already been fixed on the 7.x line (`master`):

- **PR #667** (merge `378e41d8`, feat commit `6911aaff`, follow-ups `5d952ae4`,
  `6aac341a`, `4c859625`, `ad57abe3`) — cluster-wide `/metrics` aggregation.
  Accepted design doc: `git show origin/master:specs/aggregate-prom-client-metrics-across-cluster-wor.md`.
- **PR #673** (branch `fix/metrics-undefined-handler-label`, base `master`, still
  **OPEN** at the time of writing) — never emit `runtime_http_*` samples without a
  `handler` label.

The 6.x maintenance line (currently `@vtex/api@6.51.0`, shipped in older runtimes
such as `service-node` images bundling `6.42.0`) **never received either change**.
This backport ports both, as a single PR, so the 6.x line jumps straight to the
correct end state and never reproduces the broken intermediate state that
`service-node:7.7.14` (`@vtex/api@7.4.1`, aggregation without the handler-label
fix) exhibited.

### The undefined-handler-label follow-up (PR #673) — why it must ship together

`ctx.requestHandlerName` is only assigned inside a route pipeline or by a builtin
handler, but `addRequestMetricsMiddleware` is mounted at the top of the chain and
counts **every** request in a `finally` block. Requests that never reach a named
handler (unmatched paths → 404, replica-level rate-limit rejections → 429,
`/_status` polls, unimplemented/unknown route ids, aborted requests) are therefore
counted with `handler: undefined`.

In-process, prom-client keeps the key and renders it as `handler="undefined"`.
But **Node's cluster IPC serializes messages with `JSON.stringify`, which drops
`undefined` values** — so once aggregation (change 1) is in place, the sample
reaches the master with the `handler` label key gone entirely. That produces a
second, nameless series `runtime_http_requests_total{status_code="200"}`, which
Prometheus reads as `handler=""`. This:

- is a **different series** from the historical `handler="undefined"`, splitting
  panels at the rollout boundary;
- breaks Grafana `{{handler}}` interpolation (falls back to the field name
  `Value`);
- breaks exclusion filters — `handler!~"builtin:.*|undefined"` does not match
  `""`, so the previously-filtered bucket leaks back in.

Because the broken series only appears **as a consequence of aggregation**, both
changes must land in the same 6.x PR.

### 6.x facts verified in-repo

- 6.x pins `prom-client@^14.2.0` (same as master), so `AggregatorRegistry` and the
  cluster IPC protocol are available with no dependency bump.
- `AggregatorRegistry`'s default `registries = [globalRegistry]` is exactly the
  `register` our instruments and `collectDefaultMetrics()` write to, so **no**
  `setRegistries` call is needed. Its constructor idempotently installs
  prom-client's master `cluster.on('message')` collector (master) and worker
  `process.on('message')` responder (worker).
- `serviceJSON.workers` is the reliable multi/single switch (already resolves
  `LINKED → 1` and caps at `MAX_WORKERS`).
- 6.x `src/service/metrics/` contains **only** `requestMetricsMiddleware.ts` —
  there is **no** `otelRequestMetricsMiddleware.ts` and no OpenTelemetry metrics
  client. The otel slice of PR #673 is skipped.
- 6.x `master.ts` / `worker/index.ts` / `builtIn/middlewares.ts` have drifted from
  master (e.g. 6.x `middlewares.ts` imports `COLOSSUS_ROUTE_ID_HEADER` directly,
  master imports `HeaderKeys`; 6.x `worker/index.ts` has no otel middleware and
  keeps the `.reduce(mergeDeepRight as any)` form). Intent is ported to match 6.x
  code style, not cherry-picked.
- Toolchain: `jest@^25.1.0`, `ts-jest@^25.2.1`, `typescript@^4.4.4`, `tslint@^5`.
  Tests must run under this toolchain.

---

## Proposed approach

**Serve `/metrics` from an aggregate that the master builds from all workers,
requested by the answering worker over the existing cluster IPC — and guarantee
every `runtime_http_*` sample carries a non-empty `handler` label so the aggregate
keeps the historical series identity.**

### Change 1 — cluster-wide aggregation

Flow (multi-worker mode, `serviceJSON.workers > 1`):

1. Master, in `startMaster`, constructs a single `AggregatorRegistry`
   (`initMasterAggregatorRegistry()`), enabling prom-client's master-side
   collector listener.
2. Each worker, in `startWorker`, constructs an `AggregatorRegistry`
   (`ensureWorkerAggregatorRegistry()`), so prom-client's worker-side
   `getMetricsReq` responder is installed in every worker.
3. On `GET /metrics`, the worker sends a tagged, correlation-id'd IPC request
   (`process.send({ type: AGG_METRICS_REQ, id })`) to the master and awaits a
   matching `AGG_METRICS_RES`, with a bounded timeout, then serves the returned
   exposition string with `Content-Type: register.contentType`.
4. The master, on `AGG_METRICS_REQ`, calls `aggregatorRegistry.clusterMetrics()`,
   which fans `getMetricsReq` out to **all** connected workers (including the
   requester — so it is one of N merged sources, never double-counted), merges the
   per-metric samples, and replies to that worker only:
   `worker.send({ type: AGG_METRICS_RES, id, body })` (or `{ id, error }`).

Single-worker mode (`serviceJSON.workers === 1`, includes `LINKED`) keeps the
**exact current behaviour**: `await eventLoopLagMeasurer.updateInstrumentsAndReset()`
then `ctx.body = await register.metrics()`, with no IPC.

Robustness: on IPC error/timeout (prom-client's `clusterMetrics()` has its own 5s
timeout; we guard slightly above at 6s), the worker falls back to serving its
**local** `register.metrics()` and still returns 200. Logged, not fatal.

Both `onMessage` handlers (master and worker) gain branches to route the new
messages and to **silently ignore** prom-client's own `prom-client:getMetricsReq`
/ `prom-client:getMetricsRes` IPC messages (handled by prom-client's own
listeners) instead of `logger.warn`-ing on them, while `UP_SIGNAL` /
`statusTrack` continue to be handled as before.

### Change 2 — never emit an empty/missing `handler` label

A tiny helper resolves the label with an explicit `'undefined'` string fallback
(deliberately that exact string — see below), used at every
`requestMetricsMiddleware` call site, still evaluated inside the callbacks /
`finally` block so the handler name is read *after* the pipeline ran. Plus,
`statusTrackHandler` sets `ctx.requestHandlerName = 'builtin:status-track'` for
parity with the sibling builtins.

Why the literal `'undefined'` (documented next to the constant): prom-client's
local exposition already rendered `handler: undefined` as `handler="undefined"`
before aggregation existed. Keeping that exact value makes the aggregated output
match the historical series identity so existing dashboards, `{{handler}}`
interpolation, and `handler!~"builtin:.*|undefined"` filters keep working. Empty
strings fall back too (`requestHandlerName || UNNAMED_REQUEST_HANDLER`), so the
label is never emitted empty.

### New/changed module boundary

A dedicated module `src/service/metrics/clusterMetricsAggregator.ts` owns the
message-type constants + type guards, the master-side `AggregatorRegistry`
singleton and request handler, and the worker-side registry setup + correlated
request/response + timeout + local fallback. Keeping this in one module keeps
`master.ts`, `worker/index.ts` and `middlewares.ts` changes minimal and testable
in isolation with IPC mocks.

`src/service/metrics/requestHandlerLabel.ts` owns the label constant + resolver.

---

## Files / components to change

| File | Change |
| --- | --- |
| `src/service/metrics/clusterMetricsAggregator.ts` *(new)* | Message constants (`AGG_METRICS_REQ`, `AGG_METRICS_RES`) + guards (`isAggMetricsRequest`, `isAggMetricsResponse`, `isPromClientMessage`); master `initMasterAggregatorRegistry()` + `handleWorkerMetricsRequest(worker, message)`; worker `ensureWorkerAggregatorRegistry()`, `requestAggregatedMetrics()`, `handleMasterMetricsResponse(message)`; a `__resetForTests()` helper. Ported ~verbatim from `git show 378e41d8:src/service/metrics/clusterMetricsAggregator.ts`. |
| `src/service/metrics/requestHandlerLabel.ts` *(new)* | `UNNAMED_REQUEST_HANDLER = 'undefined'` (with the documented reasoning) and `requestHandlerLabel(name?) => name || UNNAMED_REQUEST_HANDLER`. |
| `src/service/metrics/requestMetricsMiddleware.ts` | Import `requestHandlerLabel`; wrap `ctx.requestHandlerName` at all four call sites (aborted, response sizes, total, timings). 6.x keeps the `create*Instrument()` factory imports — only the call sites change. |
| `src/service/master.ts` | Import from the aggregator module; export `onMessage` (for tests); in `onMessage`, route `AGG_METRICS_REQ` → `handleWorkerMetricsRequest` and ignore `isPromClientMessage` before the `logger.warn` fallback; in `startMaster`, `if (numWorkers > 1) initMasterAggregatorRegistry()`. |
| `src/service/worker/index.ts` | Import from the aggregator module; export `onMessage`; in `onMessage`, route `AGG_METRICS_RES` → `handleMasterMetricsResponse` and ignore `isPromClientMessage`; in `startWorker`, `if (serviceJSON.workers > 1) ensureWorkerAggregatorRegistry()` and pass the worker count into `prometheusLoggerMiddleware(serviceJSON.workers)`. **Do not** port the master-only otel middleware or the `.reduce`/`filter` typing refactor (that drift is unrelated to this backport). |
| `src/service/worker/runtime/builtIn/middlewares.ts` | `prometheusLoggerMiddleware(workers = 1)`; compute `isMultiWorker = workers > 1`; serve `isMultiWorker ? await requestAggregatedMetrics() : await register.metrics()`. Keep the `/metrics` early return, the `COLOSSUS_ROUTE_ID_HEADER` guard, and `collectDefaultMetrics()`/`eventLoopLagMeasurer` exactly as-is. |
| `src/service/worker/runtime/statusTrack.ts` | `statusTrackHandler` sets `ctx.requestHandlerName = 'builtin:status-track'` and passes it to `setOperationName`. |
| `package.json` | Bump `version` `6.51.0` → `6.52.0`. **Leave `prom-client` unchanged.** |
| `CHANGELOG.md` | Add an `## [Unreleased]` / `6.52.0` entry describing both the aggregation and the handler-label fix. |
| Test files under `__tests__/` *(new)* | See Test plan. |

**Not created / not changed:** `src/service/metrics/otelRequestMetricsMiddleware.ts`
is deliberately absent on 6.x and must stay absent. No metric name, label name,
help text or bucket changes.

---

## How each `AC:` line will be satisfied

1. **PR base = 6.x and merge-base on origin/6.x, not origin/master.** The working
   branch was recreated with `git reset --hard origin/6.x`; verified
   `git merge-base --is-ancestor HEAD origin/6.x` is true and
   `--is-ancestor HEAD origin/master` is false. The PR is opened with `--base 6.x`.

2. **`clusterMetricsAggregator.ts` exports a master-side handler and a worker-side
   request fn.** The module exports `handleWorkerMetricsRequest(worker, message)`
   (master) and `requestAggregatedMetrics(): Promise<string>` (worker), plus the
   supporting setup/guards.

3. **`requestHandlerLabel.ts` returns `'undefined'` for missing and empty input.**
   `requestHandlerLabel(undefined) === 'undefined'` and
   `requestHandlerLabel('') === 'undefined'` via `name || UNNAMED_REQUEST_HANDLER`.

4. **A test asserts aggregating N registries (each `inc`'d once, identical labels)
   yields exactly N.** `clusterMetricsAggregator.test.ts` builds N in-memory
   worker registries, `inc()`s the same `runtime_http_requests_total{handler,status_code}`
   once each, aggregates via `AggregatorRegistry.aggregate`, and asserts the series
   equals `N`.

5. **A test round-trips registries through `JSON.parse(JSON.stringify(...))` before
   aggregating and asserts no emitted sample has a missing/empty `handler`.** A test
   (in the handler-label suite) applies `overClusterIpc = p => JSON.parse(JSON.stringify(p))`
   to each worker's `getMetricsAsJSON()` before `AggregatorRegistry.aggregate`,
   drives a request with `ctx.requestHandlerName = undefined`, and asserts every
   `runtime_http_*` sample matches `/handler="[^"]+"/` (and that
   `runtime_http_requests_total{status_code=` — the label-less series — is absent).

6. **A test asserts `workers === 1` serves `register.metrics()` and makes no
   `process.send` IPC call.** `middlewares.test.ts` builds
   `prometheusLoggerMiddleware(1)`, mocks a `/metrics` ctx, asserts
   `ctx.body === await register.metrics()`, `Content-Type === register.contentType`,
   and that `process.send` was not called.

7. **A test asserts a `collectDefaultMetrics` series (e.g.
   `process_cpu_seconds_total`) is present in the aggregated output.** The
   aggregation test enables `collectDefaultMetrics()` into a worker registry and
   asserts the merged exposition contains `process_cpu_seconds_total`.

8. **A test asserts IPC timeout/error → local `register.metrics()` fallback,
   still 200.** Using fake timers and a mocked `process.send`, a test drives
   `requestAggregatedMetrics()` past `AGG_METRICS_TIMEOUT_MS` (and separately a
   throwing `process.send`) and asserts it resolves with the local
   `register.metrics()` body; a middleware-level assertion confirms `ctx.status === 200`.

9. **A test asserts `GET /_status` sets `ctx.requestHandlerName` to
   `builtin:status-track`.** `statusTrack.test.ts` calls `statusTrackHandler(ctx)`
   and asserts `ctx.requestHandlerName === 'builtin:status-track'` (and that
   `setOperationName` received the same value), including the `tracing: undefined`
   case.

10. **`yarn test` exits 0.** New tests target the 6.x jest@25 / ts-jest@25
    toolchain; existing tests stay green because `onMessage` gains branches only
    (known messages unchanged).

11. **`yarn lint` exits 0.** New code follows `tslint-config-vtex` (alphabetized
    object literals, import order) as in surrounding 6.x files.

12. **`yarn build` exits 0.** Types compile under `typescript@^4.4.4`:
    `AggregatorRegistry`, `clusterMetrics(): Promise<string>`, message interfaces,
    and the `prometheusLoggerMiddleware(workers = 1)` signature.

13. **`package.json` version bumped above `6.51.0`; `CHANGELOG.md` covers both
    changes.** Bump to `6.52.0`; changelog entry describes aggregation + the
    handler-label fix.

14. **No `otelRequestMetricsMiddleware.ts`; `prom-client` unchanged.** That file is
    not added; the `prom-client` dependency entry stays `^14.2.0`.

---

## Risks & alternatives considered

**Assumptions (no human available to confirm):**

- **Version bump = `6.52.0`.** These are behavioural fixes (bug-fix in effect, but
  they change how `/metrics` aggregates and add a handler label). On master the
  aggregation shipped as a minor (`7.4.0 → 7.4.1` was the *patch* for the feature
  merge, but the feature itself landed in the `7.4.x` line). To stay clearly above
  `6.51.0` and signal new behaviour, a minor bump `6.52.0` is chosen. If the 6.x
  maintainers prefer a patch (`6.51.1`), that is a one-line change.
- **PR #673 is still OPEN** at authoring time, so its branch
  `origin/fix/metrics-undefined-handler-label` is the source of truth for change 2.
  If it merges to master before implementation, the merged version is preferred.
  The label value `'undefined'` and the `statusTrack` parity are stable regardless.
- **`AGG_METRICS_TIMEOUT_MS = 6000`** (just above prom-client's internal 5s) is
  carried over from master. Prometheus scrape timeouts are typically ≥10s, so the
  fallback returns well within budget.

**Risks & mitigations:**

- *IPC handler collisions / log noise.* prom-client adds its own message listeners
  that fire alongside our `onMessage` handlers, which today `warn` on unknown
  messages. Both handlers are updated to silently ignore `isPromClientMessage(...)`
  and unmatched aggregate ids. Behavioural drift on existing known messages is
  avoided by only *adding* branches, never altering the `UP_SIGNAL` /
  `statusTrack` / `isLog` branches.
- *Latency / dead worker.* Bounded worker-side wait + local fallback keeps
  `/metrics` answering 200 promptly even if a worker is slow/dead.
- *Event-loop-lag gauges.* `AggregatorRegistry` sums gauges across workers by
  default, which is not a meaningful aggregation for the lag gauges, and
  non-answering workers won't have refreshed their lag gauge at scrape time. This
  is a pre-existing per-worker artifact and is **out of scope** (custom aggregators
  for the lag gauges are a documented follow-up). The answering worker still calls
  `updateInstrumentsAndReset()` in both paths to preserve current behaviour.
- *`io_http_requests_current` gauge* is also summed across workers; that is
  arguably the desired "current concurrent requests across the replica" and
  matches/improves current behaviour. Noted, not changed.
- *6.x drift.* `worker/index.ts` on 6.x lacks the otel middleware and keeps the
  older `.reduce(mergeDeepRight as any)` handler-merge form; only the aggregation
  wiring is added, the unrelated master-only refactors are **not** ported.

**Alternatives considered (from the accepted master spec):**

- *Move `/metrics` to the master process* (separate listener): cleanest
  conceptually but the master is not a Koa HTTP server and doesn't listen on
  `HTTP_SERVER_PORT`; too invasive. Rejected.
- *Shared memory / external counter store*: over-engineered; prom-client already
  ships the IPC aggregation protocol. Rejected.
- *Sticky-session the scrape to one worker*: still under-reports 3/4 of traffic.
  Rejected.
- *A nicer sentinel than `'undefined'` (e.g. `'unnamed'`)*: would split series at
  the rollout boundary and break existing exclusion filters. Rejected in favour of
  preserving historical series identity.

---

## Test plan

Framework: existing Jest + ts-jest (jest@25). New specs under `__tests__/` next to
the touched code.

1. **`src/service/metrics/__tests__/clusterMetricsAggregator.test.ts`**
   (ported/adapted from master):
   - registry lifecycle: `initMasterAggregatorRegistry` / `ensureWorkerAggregatorRegistry`
     idempotent.
   - message guards: `isAggMetricsRequest` / `isAggMetricsResponse` /
     `isPromClientMessage` recognise the right shapes.
   - **AC4** — sum across N workers: N registries each `inc`'d once → series == N.
   - **AC7** — `collectDefaultMetrics()` series (`process_cpu_seconds_total`)
     present in the aggregate.
   - **AC8** — `requestAggregatedMetrics()` falls back to local `register.metrics()`
     on timeout (fake timers past 6s) and on a throwing `process.send`; resolves
     with the local body.
   - request/response correlation: a mocked master reply resolves the pending
     promise with `body` by id.
2. **`src/service/metrics/__tests__/requestHandlerLabel.test.ts`**:
   - **AC3** — `UNNAMED_REQUEST_HANDLER === 'undefined'`;
     `requestHandlerLabel(undefined)` and `requestHandlerLabel('')` both return
     `'undefined'`; a named handler passes through untouched.
   - **AC5** — drive `addRequestMetricsMiddleware()` with `ctx.requestHandlerName =
     undefined`, run the worker registry through `overClusterIpc` (real
     `JSON.parse(JSON.stringify(...))`) before `AggregatorRegistry.aggregate`, and
     assert every `runtime_http_*` sample matches `/handler="[^"]+"/` and the
     label-less `runtime_http_requests_total{status_code=` series is absent. Also
     covers aborted requests and named/unnamed as separate series.
3. **`src/service/worker/runtime/builtIn/__tests__/middlewares.test.ts`**:
   - **AC6** — `prometheusLoggerMiddleware(1)` on a `/metrics` ctx sets
     `ctx.body === register.metrics()`, correct `Content-Type`, and makes no
     `process.send` call; multi-worker path uses `requestAggregatedMetrics`.
   - non-`/metrics` and `COLOSSUS_ROUTE_ID_HEADER` requests still call `next()`
     and are not counted; `ctx.status === 200` on the aggregate path (AC8 surface).
4. **`src/service/worker/runtime/__tests__/statusTrack.test.ts`**:
   - **AC9** — `statusTrackHandler` sets `ctx.requestHandlerName ===
     'builtin:status-track'` (with and without `ctx.tracing`).
5. **`src/service/__tests__/master.test.ts` / `src/service/worker/__tests__/onMessage.test.ts`**
   (adapted to 6.x exported `onMessage`):
   - master `onMessage` routes `AGG_METRICS_REQ` and no longer warns on
     `prom-client:*`; still handles `statusTrack` / `isLog`.
   - worker `onMessage` routes `AGG_METRICS_RES` and no longer warns on
     `prom-client:*`; still handles `UP_SIGNAL` / `statusTrack`.
6. **Gates:** `yarn test`, `yarn lint`, `yarn build` all exit 0 (AC10–12).
