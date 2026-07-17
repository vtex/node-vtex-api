# Stop emitting legacy metric/status logs

Internal task id: task-ac9cfeec (bean)

## Context & problem

VTEX IO Node apps emit a legacy status-tracking log stream that is no longer
actively consumed. On every cluster-wide `/_status` tick, the master broadcasts
a `statusTrack` message to each worker; each worker runs `trackStatus()`, which
flushes the in-memory `MetricsAccumulator` and prints **one `console.log` line
per flushed metric**, each tagged `type: 'metric/status'` and wrapped in a
`__VTEX_IO_LOG` envelope. These lines are indexed into `io_vtex_logs`
(query: `* AND vtex.search_index:="io_vtex_logs" AND type:="metric/status"`)
and add up to roughly **10 million indexed log entries per hour** across the
fleet, for a stream nobody reads.

The sole emitter is `logStatus` in `src/service/worker/runtime/statusTrack.ts`,
invoked for every value returned by `global.metrics.statusTrack()`:

```50:60:src/service/worker/runtime/statusTrack.ts
const logStatus = (status: EnvMetric) => console.log(JSON.stringify({
  __VTEX_IO_LOG: true,
  account: ACCOUNT,
  app: APP.ID,
  isLink: LINKED,
  pid: process.pid,
  production: PRODUCTION,
  status,
  type: 'metric/status',
  workspace: WORKSPACE,
}))
```

```36:44:src/service/worker/runtime/statusTrack.ts
export const trackStatus = () => {
  // Update diagnostics metrics (gauges for HTTP agent stats)
  HttpAgentSingleton.updateHttpAgentMetrics()

  // Legacy status tracking (console.log export)
  global.metrics.statusTrack().forEach(status => {
    logStatus(status)
  })
}
```

`global.metrics.statusTrack()` calls `MetricsAccumulator.flushMetrics()`
(`src/metrics/MetricsAccumulator.ts:116`), which **drains** the accumulated
metric batches and returns them. This flush must keep happening: it is what
prevents batched legacy metrics from accumulating unbounded in worker memory.
The diagnostics HTTP-agent gauge refresh (`HttpAgentSingleton.updateHttpAgentMetrics()`)
must also keep happening, since it feeds the OpenTelemetry `http_agent_*`
gauges exposed through the diagnostics pipeline.

### What must NOT change
- The `/_status` route handler (`statusTrackHandler`) and the
  `broadcastStatusTrack` / `statusTrack` IPC flow between master and workers.
- Prometheus `/metrics` output (prom-client, including its independent cluster
  aggregation).
- `__VTEX_IO_LOG` application logs emitted elsewhere (structured app logging).
- `__VTEX_IO_BILLING` process-time logs.
- Diagnostics metrics (`http_agent_*` gauges and everything else via
  `global.diagnosticsMetrics`).

## Proposed approach

Remove **only** the console-log export from `trackStatus()` while preserving
every side effect that other systems depend on:

1. Delete the private `logStatus` helper (it has no other callers; it is not
   exported).
2. In `trackStatus()`, keep calling `HttpAgentSingleton.updateHttpAgentMetrics()`
   exactly once, and keep calling `global.metrics.statusTrack()` exactly once,
   but **discard its return value** instead of iterating and logging it. The
   call is retained purely for its flushing side effect.
3. Remove the now-unused imports that were only used by `logStatus`
   (`ACCOUNT`, `APP`, `PRODUCTION`, `WORKSPACE` from `../../../constants`, and
   `LINKED` **only if** it is no longer referenced elsewhere in the file).
   Note: `LINKED` is still used by `statusTrackHandler`, so it stays.
   `EnvMetric` / `NamedMetric` / `StatusTrack` type exports stay — they are
   imported by `src/metrics/MetricsAccumulator.ts` and are part of the public
   surface.

Resulting shape (illustrative, not final code):

```ts
export const trackStatus = () => {
  // Refresh diagnostics gauges for HTTP agent stats.
  HttpAgentSingleton.updateHttpAgentMetrics()

  // Flush accumulated legacy metric batches so they do not grow unbounded
  // in memory. The result is intentionally discarded: the legacy
  // `type: metric/status` console.log export has been removed.
  global.metrics.statusTrack()
}
```

## Files / components to change

| File | Change |
|------|--------|
| `src/service/worker/runtime/statusTrack.ts` | Remove `logStatus`; make `trackStatus()` call `statusTrack()` and discard the result; drop imports only used by `logStatus`. |
| `src/service/worker/runtime/statusTrack.test.ts` (new) | Focused unit test for the three `trackStatus()` behaviors. |
| `docs/METRICS_CATALOG.md` | Update the visual-summary node and the `MetricsAccumulator` section so they no longer describe values as `console.log` exports; document that status ticks flush and discard them. |

Explicitly **not** changed: `src/service/master.ts`, `src/service/worker/index.ts`
(callers of `trackStatus()`), `statusTrackHandler`, `broadcastStatusTrack`,
`isStatusTrack`, `isStatusTrackBroadcast`, `MetricsAccumulator`, prom-client
setup, billing logs.

## How each AC line will be satisfied

- **AC: `trackStatus()` emits no `console.log` containing `type: metric/status`.**
  The `logStatus` helper (the only source of that line) is deleted and no longer
  called. Test spies on `console.log` and asserts no call's argument matches
  `type":"metric/status"`.

- **AC: `trackStatus()` invokes `global.metrics.statusTrack()` exactly once.**
  The single retained call flushes legacy batches. Test mocks
  `global.metrics.statusTrack` and asserts it is called exactly once.

- **AC: `trackStatus()` invokes `HttpAgentSingleton.updateHttpAgentMetrics()`
  exactly once.** The call is kept as-is. Test spies/mocks the static method and
  asserts exactly one invocation.

- **AC: A focused automated test covers the three behaviors above.**
  New `statusTrack.test.ts` asserts (1) no `metric/status` console.log, (2) one
  `statusTrack()` call, (3) one `updateHttpAgentMetrics()` call.

- **AC: `/_status` route and `broadcastStatusTrack`/`statusTrack` IPC flow
  remain unchanged.** No edits to `statusTrackHandler`, `broadcastStatusTrack`,
  the message-type guards, or the master/worker `onMessage` handlers.

- **AC: Prometheus `/metrics`, `__VTEX_IO_LOG` app logs, and `__VTEX_IO_BILLING`
  process-time logs remain unchanged.** None of those code paths are touched;
  only the `metric/status` export inside `trackStatus()` is removed. prom-client
  cluster aggregation is independent of this legacy export.

- **AC: `docs/METRICS_CATALOG.md` no longer describes MetricsAccumulator values
  as console.log exports and documents flush-and-discard.** The visual-summary
  line `📝 MetricsAccumulator (console.log exports via trackStatus)` and the
  `### MetricsAccumulator` sub-section text (`Exported via console.log as JSON
  and collected by Splunk.`) are rewritten to state that these values are
  accumulated in memory and, on each `/_status` tick, flushed and discarded by
  `trackStatus()` (no longer exported via `console.log`).

- **AC: `yarn test`, `yarn lint`, and `yarn build` pass.** Removing the unused
  helper and its now-orphaned imports keeps TypeScript and tslint clean
  (unused imports would otherwise fail lint/build); the new test runs under the
  existing jest config.

## Risks & alternatives considered

- **Assumption — the `metric/status` stream is truly unused.** The task states
  it is no longer actively used; this spec trusts that. If a downstream
  consumer still depends on it, this removal is a breaking change. Mitigation:
  the flush side effect is preserved, so only the log export (not the data
  aggregation) is removed, and it can be re-added if needed.

- **Assumption — discarding the `statusTrack()` return is enough to keep memory
  bounded.** `flushMetrics()` drains internal state regardless of whether the
  return value is consumed, so calling and ignoring it is equivalent, memory-wise,
  to the previous iterate-and-log behavior.

- **Alternative — remove the entire `trackStatus()`/IPC path.** Rejected:
  it would stop the diagnostics HTTP-agent gauge refresh and let legacy metric
  batches accumulate unbounded in worker memory (explicitly disallowed by the
  task notes).

- **Alternative — gate the log behind an env flag.** Rejected as unnecessary
  scope; the stream is unused, so an outright removal is simpler and the flush
  behavior is retained regardless.

- **Import cleanup risk.** `LINKED` is still referenced by `statusTrackHandler`,
  so it must be kept; only imports exclusively used by `logStatus`
  (`ACCOUNT`, `APP`, `PRODUCTION`, `WORKSPACE`) are removed. This will be
  verified by `yarn build`/`yarn lint`.

## Test plan

New file `src/service/worker/runtime/statusTrack.test.ts` (jest + ts-jest, per
existing `HttpAgentSingleton.test.ts` conventions):

1. **No legacy log** — mock `global.metrics.statusTrack` to return a non-empty
   array of `EnvMetric` values, spy on `console.log`, call `trackStatus()`, and
   assert no `console.log` argument contains `type":"metric/status"` (nor the
   `__VTEX_IO_LOG` status envelope).
2. **Flush still happens** — assert `global.metrics.statusTrack` was called
   exactly once.
3. **Diagnostics gauge refresh** — mock/spy
   `HttpAgentSingleton.updateHttpAgentMetrics` and assert exactly one call.

Setup/teardown: stub `global.metrics` in `beforeEach` and restore spies in
`afterEach` so the test does not leak global state (mirrors the existing
`HttpAgentSingleton.test.ts` pattern).

Full gate: `yarn test`, `yarn lint`, and `yarn build` must all pass.
