# Spec: Aggregate prom-client metrics across cluster workers for `/metrics`

> **Status: accepted.** This document describes the change, which is implemented
> in this PR.

---

## Context & problem

VTEX IO runtimes run as a Node.js `cluster`: the master (`src/service/master.ts`)
forks `min(cpus, MAX_WORKERS=4)` workers (`src/service/loaders.ts` `getWorkers`,
`src/constants.ts` `MAX_WORKERS`), each worker listening on the same shared port
(`HTTP_SERVER_PORT`, `src/service/index.ts`). Every worker keeps its **own**
prom-client default registry (`register` from `prom-client`): the request
counters are created per-worker in
`src/service/metrics/requestMetricsMiddleware.ts` via
`src/service/tracing/metrics/instruments.ts` (`new Counter(REQUESTS_TOTAL)` etc.),
and `collectDefaultMetrics()` is called per-worker in
`src/service/worker/runtime/builtIn/middlewares.ts`.

The `/metrics` endpoint is served by `prometheusLoggerMiddleware`
(`src/service/worker/runtime/builtIn/middlewares.ts:24-42`). It answers with
`register.metrics()` — i.e. **only the local registry of whichever worker the OS
round-robin handed the scrape connection to**. Because Node's keep-alive socket
timeout (5s) is shorter than the Prometheus scrape interval, almost every scrape
lands on a *different* worker.

Consequence: Prometheus sees, under a single `instance` label, an interleaved
braid of 4 independent monotonic counters. Each time a scrape hits a worker whose
local count is lower than the previously scraped worker's, Prometheus treats the
drop as a **counter reset**, so `rate()` / `increase()` over `runtime_*` counters
(notably `runtime_http_requests_total{handler,status_code}`) are inflated by
orders of magnitude (~×40 measured on a live pod). Full analysis:
`metrics-discrepancy-report.html`, sections 3 and 9.1; this task is
recommendation 1 in section 9.

The pinned `prom-client@^14.2.0` ships `AggregatorRegistry` and a cluster
IPC protocol precisely for this: workers report their registry to the master over
`cluster` messaging, and the master merges them into a single monotonic view.

### Relevant existing facts (verified in-repo)

- `prom-client@14.2.0` exports `AggregatorRegistry` with:
  - instance method `clusterMetrics(): Promise<string>` (master-side; requests
    every connected worker's registry-as-JSON, aggregates, returns exposition
    text).
  - static `AggregatorRegistry.aggregate(metricsArr)` and `setRegistries(regs)`.
  - The constructor calls `addListeners()`, which is **idempotent** and installs:
    - in the **master**: a `cluster.on('message')` listener collecting
      `prom-client:getMetricsRes` responses.
    - in a **worker**: a `process.on('message')` listener that answers
      `prom-client:getMetricsReq` with `registries.map(r => r.getMetricsAsJSON())`.
  - Default `registries = [globalRegistry]`, which is exactly the `register` our
    instruments and `collectDefaultMetrics()` write to — so **no** `setRegistries`
    call is needed.
- `clusterMetrics()` is only useful in the **master** (it iterates
  `cluster.workers`). But `/metrics` is served **inside a worker** (Koa
  middleware). So the answering worker must obtain the aggregate from the master
  over IPC.
- Existing IPC message plumbing to mirror:
  - Master → worker and worker → master string/tagged messages already exist:
    `UP_SIGNAL` (`src/constants.ts`), `statusTrack` / `broadcastStatusTrack`
    (`src/service/worker/runtime/statusTrack.ts`), routed by `onMessage` in
    `src/service/master.ts` and `onMessage(serviceJSON)` in
    `src/service/worker/index.ts`.
  - Both `onMessage` handlers currently `logger.warn(...)` on any unrecognized
    message. prom-client's own `getMetricsReq`/`getMetricsRes` messages and our
    new aggregate messages will also reach these handlers, so both must be taught
    to ignore messages they don't own instead of warning.
- Scrapes of `/metrics` are excluded from request counters today because
  `prometheusLoggerMiddleware` runs **before** the counting middlewares in the
  Koa chain (`src/service/worker/index.ts`) and returns without calling `next()`
  for the `/metrics` path. This must be preserved.
- Single-worker mode: `getWorkers()` returns `1` when `LINKED`
  (`src/service/loaders.ts`). `serviceJSON.workers` carries the resolved count.

---

## Proposed approach

**Serve `/metrics` from an aggregate that the master builds from all workers,
requested by the answering worker over the existing cluster IPC.**

Flow (multi-worker mode, `serviceJSON.workers > 1`):

1. Master, at `startMaster`, constructs a single `AggregatorRegistry`
   (`new AggregatorRegistry()`), enabling both prom-client's master-side
   collector listener and our own request handler.
2. Each worker, at `startWorker`, constructs an `AggregatorRegistry` too, so
   prom-client's worker-side `getMetricsReq` responder is installed in every
   worker. (Its own registry is still the default `register`.)
3. When a worker receives `GET /metrics`, instead of returning
   `register.metrics()`, it sends a tagged IPC request to the master
   (`process.send({ type: AGG_METRICS_REQ, id })`) and awaits a matching
   `AGG_METRICS_RES` (correlation id + a bounded timeout), then serves the
   returned exposition string with `Content-Type: register.contentType`.
4. The master, on `AGG_METRICS_REQ`, calls `aggregatorRegistry.clusterMetrics()`.
   prom-client fans `getMetricsReq` out to **all** connected workers (including
   the one that asked), collects each worker's registry JSON, merges with the
   per-metric aggregators, and resolves to a single exposition string. The master
   replies to the requesting worker only:
   `worker.send({ type: AGG_METRICS_RES, id, body })` (or `{ id, error }`).

Because the merge is produced from every worker's registry gathered in one pass,
the answering worker is **not** double-counted (it is one of the N sources, not a
source plus a separate local merge).

Single-worker mode (`serviceJSON.workers === 1`, includes `LINKED`): the
middleware keeps its **current** behavior exactly — `await eventLoopLagMeasurer
.updateInstrumentsAndReset()` then `ctx.body = await register.metrics()`. No IPC,
no aggregation. This keeps LINKED/dev and the `workers:1` production case
unchanged and avoids IPC overhead when there is nothing to aggregate.

Robustness: if the IPC round-trip errors or times out (prom-client's
`clusterMetrics` has its own 5s timeout; we add a slightly larger guard), the
worker falls back to serving its **local** `register.metrics()` so `/metrics`
never returns empty/500. This is logged, not fatal.

### New/changed module boundaries

A small dedicated module (proposed `src/service/metrics/clusterMetricsAggregator.ts`)
owns:
- message-type constants (`AGG_METRICS_REQ`, `AGG_METRICS_RES`) and their type
  guards;
- master setup: lazily create the singleton `AggregatorRegistry`, expose
  `handleWorkerMetricsRequest(worker, message)` that calls `clusterMetrics()` and
  replies;
- worker setup: `ensureWorkerAggregatorRegistry()` (constructs the registry so the
  prom-client responder is installed) and `requestAggregatedMetrics(): Promise<string>`
  (send + await correlated response, with timeout + fallback), plus
  `handleMasterMetricsResponse(message)` to resolve pending promises.

Keeping this in one module keeps `master.ts`, `worker/index.ts` and
`middlewares.ts` changes minimal and testable in isolation with IPC mocks.

---

## Files / components to change

| File | Change |
| --- | --- |
| `src/service/metrics/clusterMetricsAggregator.ts` *(new)* | Message constants + guards; master-side `AggregatorRegistry` singleton + request handler; worker-side request/response correlation, timeout, and local fallback. |
| `src/service/master.ts` | In `startMaster`, initialize the aggregator (construct `AggregatorRegistry`). In `onMessage`, route `AGG_METRICS_REQ` to `handleWorkerMetricsRequest`; ignore prom-client's `getMetricsRes`/`getMetricsReq` messages instead of `logger.warn`. |
| `src/service/worker/index.ts` | In `startWorker`, call `ensureWorkerAggregatorRegistry()`. In `onMessage(serviceJSON)`, route `AGG_METRICS_RES` to `handleMasterMetricsResponse`; ignore prom-client's `getMetricsReq` messages instead of `logger.warn`. |
| `src/service/worker/runtime/builtIn/middlewares.ts` | In `prometheusLoggerMiddleware`, when `serviceJSON.workers > 1` request the aggregate via IPC and serve it; when `== 1` keep current local-registry path. Needs access to the worker count (pass `serviceJSON`/`workers` into the middleware factory — it is constructed in `startWorker` which already has `serviceJSON`). Keep the early-return-before-counting behavior and the `COLOSSUS_ROUTE_ID` guard. |
| `src/constants.ts` *(maybe)* | Add message-type string constants if we prefer them centralized next to `UP_SIGNAL`; otherwise they live in the new module. |
| Test files under `__tests__/` *(new)* | See Test plan. |

No changes to metric names, labels, help text, buckets, or the set of collected
metrics. `runtime_http_requests_total{handler,status_code}` and all other
`runtime_*` / `io_*` series keep identical identity.

---

## How each `AC:` line will be satisfied

1. **Two consecutive scrapes never show a decreasing `runtime_http_requests_total`
   series (monotonic regardless of which worker answers).**
   After the change every scrape is served from the *same* aggregate (sum over all
   workers) instead of one arbitrary worker's local subset. A Jest test drives the
   aggregation with IPC mocks / fake worker registries: it simulates the scrape
   being answered by worker A then worker B, asserts both responses are the merged
   view, and asserts no series value decreases between the two scrapes.

2. **`/metrics` equals the sum across workers (a counter incremented once per
   worker in N workers reports N).**
   `AggregatorRegistry.aggregate` sums counter samples with matching labels across
   registries. Test: build N registries, `inc()` the same
   `runtime_http_requests_total{handler,status_code}` once in each, run them through
   the aggregation, assert the merged output reports exactly `N` for that series.

3. **`workers === 1` (LINKED) serves the default registry content unchanged.**
   The middleware branches on `serviceJSON.workers`: for `1` it executes the
   existing code path (`updateInstrumentsAndReset()` + `register.metrics()`) with no
   IPC. Test: invoke `prometheusLoggerMiddleware` built with `workers: 1` against a
   mock `/metrics` ctx and assert the body equals `register.metrics()` and no IPC
   send occurred.

4. **Default process metrics (`collectDefaultMetrics`) remain present.**
   `collectDefaultMetrics()` still runs per worker into the default registry, which
   is what each worker reports to the aggregator; the aggregate therefore includes
   them (e.g. `process_cpu_seconds_total`, `nodejs_*`). Test asserts a known
   default-metric name appears in the aggregated output, and (single-worker path) in
   the local output.

5. **`yarn test` passes.** New tests are added; existing tests remain green
   (message-routing guards keep `onMessage` behavior for known messages).

6. **`yarn lint` passes.** New code follows `tslint-config-vtex`
   (alphabetized object literals, import order) as in surrounding files.

7. **`yarn build` passes.** Types: use `AggregatorRegistry` and message
   interfaces; `clusterMetrics()` returns `Promise<string>`; middleware factory
   signature updated to receive the worker count.

---

## Risks & alternatives considered

**Assumptions (no human available to confirm):**
- The default global registry (`register`) is the only registry we need to
  aggregate. Verified: instruments and `collectDefaultMetrics` all target the
  default registry, so `AggregatorRegistry`'s default `registries=[globalRegistry]`
  is correct and `setRegistries` is unnecessary.
- `serviceJSON.workers` is the reliable multi/single switch (it already resolves
  `LINKED → 1` and caps at `MAX_WORKERS`). Chosen over reading `LINKED` directly so
  a real `workers:1` production config also takes the unchanged path.
- Serving `/metrics` from the worker (proxying to master over IPC) is preferred
  over moving the endpoint to the master, because the master is not a Koa HTTP
  server and does not listen on `HTTP_SERVER_PORT`; relocating the endpoint would
  be a much larger, riskier change.

**Risks & mitigations:**
- *IPC handler collisions / log noise.* prom-client adds its own
  `process.on('message')` / `cluster.on('message')` listeners; these fire
  alongside our `onMessage` handlers, which today `warn` on unknown messages. Both
  handlers will be updated to silently ignore messages they don't own
  (prom-client's `getMetricsReq`/`getMetricsRes` and unmatched aggregate ids). Risk
  of behavioral drift on existing known messages is avoided by only adding
  branches, not altering existing ones.
- *Latency / timeout.* `clusterMetrics()` has a built-in 5s timeout. A slow/dead
  worker could delay a scrape. Mitigation: bounded wait on the worker side plus
  fallback to local `register.metrics()` so `/metrics` still returns 200 promptly;
  the fallback is logged. Prometheus scrape timeout is typically ≥10s.
- *Event-loop-lag gauges.* `eventLoopLagMeasurer.updateInstrumentsAndReset()` is
  called only on the answering worker and lag is a **gauge**;
  `AggregatorRegistry` sums gauges across workers by default, which is not a
  meaningful aggregation for lag, and non-answering workers won't have refreshed
  their lag gauge at scrape time. This is a pre-existing per-worker artifact and is
  **out of scope** for this task (which targets `runtime_*` counters). Documented
  here so it is a conscious decision; a follow-up could set a custom aggregator
  (`max`/`average`) or `omit` for these gauges. The answering worker still calls
  `updateInstrumentsAndReset()` in both paths to preserve current behavior.
- *Ordering.* Master must have its `AggregatorRegistry` before workers ask.
  Guaranteed: it is created in `startMaster` before any worker can accept traffic.
- *`io_http_requests_current` gauge* is also summed across workers; that is
  arguably the desired "current concurrent requests across the replica" and matches
  or improves current behavior; noted, not changed.

**Alternatives considered:**
- *Move `/metrics` to the master process* (separate tiny HTTP listener):
  cleanest conceptually but adds a new listener/port and process responsibilities;
  rejected as too invasive for this fix.
- *Shared memory / external store for counters*: over-engineered; prom-client
  already provides the IPC aggregation protocol.
- *Sticky-session the scrape to one worker*: doesn't fix the underlying
  per-worker split (still under-reports 3/4 of traffic).

---

## Test plan

Framework: existing Jest + ts-jest. New specs under `__tests__/` next to the
touched code (e.g. `src/service/metrics/__tests__/clusterMetricsAggregator.test.ts`
and a middleware test alongside `builtIn/`).

1. **Monotonic across which-worker-answers (AC 1).** Construct several in-memory
   registries with differing `runtime_http_requests_total{handler,status_code}`
   values. Exercise the aggregation twice, simulating the scrape being answered by
   different workers each time (IPC mocked). Assert every series in scrape #2 is
   `>=` the same series in scrape #1 (no decrease).
2. **Sum across workers (AC 2).** N registries, each `inc()` the same series once;
   assert merged output reports `N` for that series and that per-worker distinct
   label sets are all present and summed correctly.
3. **Single-worker unchanged (AC 3).** Call `prometheusLoggerMiddleware` built with
   `workers: 1`; mock a `/metrics` ctx; assert body === `register.metrics()`,
   `Content-Type` set to `register.contentType`, and that no `process.send` IPC
   occurred. Also assert non-`/metrics` and `COLOSSUS_ROUTE_ID` requests still call
   `next()` and are not counted.
4. **Default metrics present (AC 4).** Assert a known `collectDefaultMetrics`
   series name (e.g. `process_cpu_seconds_total` / a `nodejs_` metric) appears in
   both the aggregated output and the single-worker output.
5. **IPC request/response correlation + timeout fallback.** Mock master/worker
   `send`/`on('message')`: assert a worker `AGG_METRICS_REQ` gets a correlated
   `AGG_METRICS_RES`, the pending promise resolves with the body, and that on
   timeout/error the middleware falls back to local `register.metrics()`.
6. **Message routing guards.** Assert master `onMessage` and worker `onMessage`
   route the new messages correctly and no longer `warn` on prom-client's
   `getMetricsReq`/`getMetricsRes`, while still handling `UP_SIGNAL` /
   `statusTrack` as before.
7. **Gates.** `yarn test`, `yarn lint`, `yarn build` all pass (AC 5–7).
