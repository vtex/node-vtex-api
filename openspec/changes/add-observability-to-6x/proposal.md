## Why

`node-vtex-api@6.x` apps currently ship with no metrics observability: the branch only has a bare `TelemetryClient` used exclusively to export structured logs, while `master` (`7.x`) has grown a full traces/metrics/logs stack (`DiagnosticsMetrics`, cluster resource attributes, Koa + host-metrics auto-instrumentation) built on `@vtex/diagnostics-nodejs`. Observability was withheld from `6.x` because `builder-hub` could not reliably build `7.x`-only dependency trees requiring Node > 16 at build time. That build-time isolation gap has since been closed (`service-runtime-node@6.41.0`+ provides a `node20` binary that `builder-hub` spawns for `node: 7.x` app builds), and a dependency audit of the diagnostics/OpenTelemetry package tree (`@vtex/diagnostics-nodejs@0.1.8-io`, `@vtex/diagnostics-semconv@5.5.2`, the `@opentelemetry/*` family) shows its highest `engines.node` floor is `>=14` — well within what the `node: 6.x` builder runtime (Node 16.20.2, per `service-runtime-node`'s `6.x` branch) already supports. There is no longer a technical blocker to bringing metrics observability to `6.x`.

## What Changes

- Bump `@vtex/diagnostics-nodejs` in `node-vtex-api@6.x` from `0.1.0-beta.10` to `0.1.8-io`, and add `@vtex/diagnostics-semconv` plus the `@opentelemetry/{api,host-metrics,instrumentation,instrumentation-koa}` dependencies already used on `master`.
- Rewrite `src/service/telemetry/client.ts` from a single bare `TelemetryClient` into the split traces/metrics/logs `TelemetryClientSingleton` shape used on `master`, preserving the existing logger consumer (`src/service/logger/client.ts`) which only needs the logs client.
- Port `src/service/telemetry/resourceAttributes.ts` (cluster id/role resource attributes) and its tests.
- Port `src/metrics/DiagnosticsMetrics.ts` (the `recordLatency` / `incrementCounter` / `setGauge` / `runWithBaseAttributes` public API) and its tests, unchanged from `master`.
- Add the supporting constants already present on `master` but missing on `6.x`: `AttributeKeys` (sourced from `@vtex/diagnostics-semconv`), `CLUSTER_ID`, `CLUSTER_ROLE`, `METRIC_CLIENT_INIT_TIMEOUT_MS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `DIAGNOSTICS_TELEMETRY_ENABLED`. The `HeaderKeys` refactor on `master` is unrelated cleanup and is **out of scope**.
- Wire Koa auto-instrumentation and host-metrics collection into the `6.x` service bootstrap, gated behind the existing `DIAGNOSTICS_TELEMETRY_ENABLED` env flag so the feature ships dark by default.
- Update jest mocking for `@vtex/diagnostics-nodejs` (`6.x` already stubs an older shape for jest@25 compatibility; the stub needs to match the new client surface).

No changes to `builder-hub` or `service-runtime-node` are required by this change — the build-time and runtime environments already support this dependency tree on the `node: 6.x` builder.

## Capabilities

### New Capabilities
- `diagnostics-metrics`: the `DiagnosticsMetrics` public API (latency histogram, counters, gauges, request-scoped base attributes) and its underlying `TelemetryClientSingleton` (traces/metrics/logs clients, cluster resource attributes, Koa + host-metrics instrumentation) as available to `node-vtex-api@6.x` consumers, feature-flagged via `DIAGNOSTICS_TELEMETRY_ENABLED`.

### Modified Capabilities
_None — `6.x`'s existing telemetry-backed structured logging keeps its current behavior; it is only extended, not changed._

## Impact

- **Affected code**: `src/service/telemetry/*`, `src/metrics/DiagnosticsMetrics.ts` (new), `src/constants.ts`, `__mocks__/@vtex/diagnostics-nodejs`, jest config for the new mock surface.
- **Dependencies**: `package.json` gains `@vtex/diagnostics-semconv` and the `@opentelemetry/*` quartet; `@vtex/diagnostics-nodejs` is bumped across a major beta-to-stable jump (`0.1.0-beta.10` → `0.1.8-io`) — its own changelog/breaking changes need review during implementation.
- **Consumers**: every VTEX IO app on the `node: 6.x` builder gains these dependencies transitively; verified they resolve under the `6.x` builder's Node 16.20.2 runtime with no native compilation or ESM-resolution requirements.
- **Systems**: no changes needed in `builder-hub` or `service-runtime-node`; this is scoped entirely to `node-vtex-api`.
