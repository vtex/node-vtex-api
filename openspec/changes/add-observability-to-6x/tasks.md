Each numbered group below follows red → green → refactor: write the failing spec-derived tests first, implement the minimum to pass them, then refactor with tests green throughout. No implementation task should be started before its preceding test task is committed and failing for the right reason.

## 1. Setup (prerequisite for any red test to run)

- [x] 1.1 Review the `@vtex/diagnostics-nodejs` changelog/tags between `0.1.0-beta.10` and `0.1.8-io` for breaking changes affecting `NewTelemetryClient`/`TelemetryClient` usage — found real breaking changes (extra leading `applicationID` param on `NewTelemetryClient`, `setInstrumentations` renamed to `registerInstrumentations`, config objects became `Partial<...>` overrides); confirmed `master`'s implementation already targets the new shape correctly
- [x] 1.2 Bump `@vtex/diagnostics-nodejs` to `0.1.8-io`, add `@vtex/diagnostics-semconv@5.5.2` and `@opentelemetry/{api,host-metrics,instrumentation,instrumentation-koa}` to `package.json` (versions pinned to `master`), then `yarn install` and confirm no engine warnings/failures on the `6.x` branch — clean install, no warnings
- [x] 1.3 Add a jest mock for `@vtex/diagnostics-semconv` (`__mocks__/@vtex/diagnostics-semconv.ts`, ported from `master`) and mock `@vtex/diagnostics-nodejs` inline per test file (`Exporters`, `Instrumentation`, `Logs`, `Metrics`, `Traces`, `NewTelemetryClient`), matching `master`'s convention — **correction to this task's original wording**: `6.x` had no existing diagnostics-nodejs mock to "update"; that assumption traced back to a commit that only exists on the unrelated `aerie/backport-cluster-wide-prom-client-metrics-aggreg` branch, not `6.x`
- [x] 1.4 Add `AttributeKeys` (from `@vtex/diagnostics-semconv`), `CLUSTER_ID`, `CLUSTER_ROLE`, `METRIC_CLIENT_INIT_TIMEOUT_MS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `DIAGNOSTICS_TELEMETRY_ENABLED` to `src/constants.ts`, matching `master`'s definitions (the `HeaderKeys` refactor stays out of scope)
- [x] 1.5 (added during implementation) Map `@opentelemetry/otlp-exporter-base/node-http` in `jest.config.js`'s `moduleNameMapper` — jest 25's bundled resolver predates `package.json` "exports" map support, so this OTLP gRPC exporter subpath (newly pulled in transitively by the `diagnostics-nodejs` bump) failed to resolve under tests even though Node itself resolves it fine at runtime; this was breaking two pre-existing, unrelated test suites (`rateLimit.test.ts`, `axiosTracing.test.ts`)

## 2. Cluster resource attributes

- [x] 2.1 **Red**: write `src/service/telemetry/resourceAttributes.test.ts` covering the four scenarios under "Cluster resource attributes on emitted telemetry" (both present, one missing, whitespace-only, both absent); confirm it fails because `getClusterResourceAttributes` does not exist yet
- [x] 2.2 **Green**: implement `src/service/telemetry/resourceAttributes.ts` (`getClusterResourceAttributes`) to make all four scenarios pass
- [x] 2.3 **Refactor**: clean up trimming/emptiness logic once green; re-run tests after each edit — none needed, ported verbatim from `master`

## 3. Split telemetry client (traces/metrics/logs)

- [x] 3.1 **Red**: write `src/service/telemetry/client.test.ts` covering "Split traces, metrics, and logs telemetry clients" (independent init, caching, concurrent in-flight init, `reset()`) using the updated mock from 1.3; confirm it fails against the current single-client `TelemetryClientSingleton`
- [x] 3.2 **Red**: extend the same test file for "Existing structured logging keeps working" — added `src/service/logger/client.test.ts` asserting `getLogClient` still builds its per-call (account/workspace/appName) logger correctly
- [x] 3.3 **Green**: rewrite `src/service/telemetry/client.ts` into the split `TelemetryClientSingleton` (`newTracesClient`/`newMetricsClient`/`newLogsClient`, `getTelemetryClients()`, `reset()`) to pass 3.1 — **deviates from `master`**: also exposes `getTelemetryClient()` returning the raw underlying `TelemetryClient` (see design.md addendum) because `6.x`'s logger builds a dynamic per-request logger via `newLogsClient()`, which `master`'s three-pre-built-clients-only surface doesn't support
- [x] 3.4 **Green**: `src/service/logger/client.ts` needed no signature/behavior change — it already imported `getTelemetryClient` by that exact name; only its `Exporters.CreateLogsExporterConfig(...)` call needed updating (see 1.1: `path`/`protocol`/`headers` no longer exist on `ExporterOptions` in `0.1.8-io`)
- [x] 3.5 **Refactor**: not needed — implementation matches `master`'s exporter-config structure per client, no duplication introduced
- [x] 3.6 Confirm `src/service/telemetry/index.ts` exports the shape both the logger and the new metrics client need — already `export * from './client'`, no change needed

## 4. Auto-instrumentation (Koa + host metrics)

- [x] 4.1 **Red**: extended `src/service/telemetry/client.test.ts` with instrumentation-registration scenarios (disabled → not registered; enabled → `KoaInstrumentation` registered)
- [x] 4.2 **Green**: ported `src/service/metrics/instruments/hostMetrics.ts` (`HostMetricsInstrumentation`) from `master`; registered alongside `KoaInstrumentation` in `client.ts`, gated by `DIAGNOSTICS_TELEMETRY_ENABLED`
- [x] 4.3 **Refactor**: gate is a single `if (DIAGNOSTICS_TELEMETRY_ENABLED)` block around instrumentation registration, matching `master`; no duplication

## 5. `DiagnosticsMetrics`: latency, counters, gauges

- [x] 5.1 **Red**: ported `master`'s `src/metrics/DiagnosticsMetrics.test.ts` verbatim (covers latency/counter/gauge scenarios plus base attributes and limiting from group 6 in one file, exceeding this change's spec coverage); confirmed it fails on missing modules
- [x] 5.2 **Green**: ported `src/metrics/DiagnosticsMetrics.ts` and `src/service/metrics/client.ts` verbatim from `master`
- [x] 5.3 **Refactor**: none needed — verbatim port of already-refactored code

## 6. `DiagnosticsMetrics`: base attributes and cardinality limiting

- [x] 6.1 **Red**: covered by the same ported test file from 5.1 (34 tests total, includes base-attribute merge/precedence/leak and cardinality-limit scenarios)
- [x] 6.2 **Green**: covered by the same verbatim port from 5.2
- [x] 6.3 **Refactor**: none needed

## 7. Feature flag gating

- [x] 7.1 **Red**: added `src/constants.test.ts` (unset/falsy-values/`'true'` cases) and instrumentation on/off cases already in `client.test.ts`
- [x] 7.2 **Green**: `DIAGNOSTICS_TELEMETRY_ENABLED` gates instrumentation registration in `client.ts`, and is passed as the `noop` option to `NewTelemetryClient` — telemetry clients are always constructed, but run in the SDK's built-in no-op mode when the flag is off; they are not literally skipped. Spec scenario wording updated to match.
- [x] 7.3 **Refactor**: single `noop: !DIAGNOSTICS_TELEMETRY_ENABLED` check plus single instrumentation-registration `if`, matching `master`; no duplication

## 8. Request-pipeline wiring (found missing after live-cluster verification)

Deploying `6.53.0-beta.0` to the `iotest-ju2` test cluster with `DIAGNOSTICS_TELEMETRY_ENABLED=true` surfaced that no metrics were reaching ClickHouse. Root cause: groups 1–7 ported the `DiagnosticsMetrics` API and telemetry client, but never wired them into `6.x`'s actual request pipeline — `service/index.ts` never called `initializeTelemetry()`/set `global.diagnosticsMetrics`, and none of `master`'s five consumer call sites exist on `6.x` yet. This group closes that gap.

- [ ] 8.1 **Red**: write/extend a test for `src/service/index.ts`'s `startApp()` asserting it calls `initializeTelemetry()` and sets `global.diagnosticsMetrics` to a `DiagnosticsMetrics` instance before serving requests; confirm it fails against the current implementation
- [ ] 8.2 **Green**: update `startApp()` to call `await initializeTelemetry()` and set `global.diagnosticsMetrics = new DiagnosticsMetrics()`, matching `master`; declare the `global.diagnosticsMetrics` type augmentation
- [ ] 8.3 **Red**: extend `src/service/worker/runtime/http/middlewares/timings.ts`'s test coverage with the "HTTP handler latency and counter" scenario (base attributes via `runWithBaseAttributes`, `recordLatency`, `incrementCounter('http_handler_requests_total', ...)`, graceful degradation when `global.diagnosticsMetrics` is unavailable); confirm it fails
- [ ] 8.4 **Green**: port `master`'s `global.diagnosticsMetrics` emission logic into `timings.ts` to pass 8.3
- [ ] 8.5 **Red**: extend `src/service/worker/runtime/http/middlewares/requestStats.ts`'s test coverage with the "Request lifecycle counters" scenario (closed/aborted/total); confirm it fails
- [ ] 8.6 **Green**: port `master`'s `global.diagnosticsMetrics` emission logic into `requestStats.ts` to pass 8.5
- [ ] 8.7 **Red**: extend `src/HttpClient/middlewares/metrics.ts`'s test coverage with the "Outbound HTTP client metrics" scenario; confirm it fails
- [ ] 8.8 **Green**: port `master`'s `global.diagnosticsMetrics` emission logic into `HttpClient/middlewares/metrics.ts` to pass 8.7
- [ ] 8.9 **Red**: extend `src/HttpClient/middlewares/request/HttpAgentSingleton.ts`'s test coverage with the "HTTP agent metrics" scenario; confirm it fails
- [ ] 8.10 **Green**: port `master`'s `global.diagnosticsMetrics` emission logic into `HttpAgentSingleton.ts` to pass 8.9
- [ ] 8.11 **Red**: extend `src/service/worker/runtime/graphql/schema/schemaDirectives/Metric.ts`'s test coverage with the "GraphQL `@metric` directive" scenario; confirm it fails
- [ ] 8.12 **Green**: port `master`'s `global.diagnosticsMetrics` emission logic into `Metric.ts` to pass 8.11
- [ ] 8.13 **Refactor**: confirm every emission point uses the same `if (global.diagnosticsMetrics) { ... } else { console.warn(...) }` guard shape as `master`, with no duplicated boilerplate beyond what `master` itself has

## 9. Full-suite regression and manual verification

- [x] 9.1 Ran the complete `6.x` jest suite after groups 1–7: 88/88 tests pass across 8 suites; 1 pre-existing suite (`axiosTracing.test.ts`) fails on an unrelated TypeScript strictness error in `TestServer.ts` (`resolve()` called with no argument) — confirmed pre-existing via unchanged `yarn.lock` `typescript@4.9.5` resolution and a zero-diff on that file; not caused by this change
- [ ] 9.2 Re-run the full jest suite after group 8 lands; confirm no regressions
- [x] 9.3 Manually verify in a non-production workspace with `DIAGNOSTICS_TELEMETRY_ENABLED=true` — **done, and this is what surfaced the group-8 gap**: deployed `6.53.0-beta.0` to the `iotest-ju2` cluster; telemetry clients initialize (per the flag) but no per-request metrics reached ClickHouse, because nothing called the emission points. Re-verify after group 8 lands that `io_app_operation_duration_milliseconds` and the HTTP/GraphQL counters actually arrive.
- [ ] 9.4 Manually verify with the flag unset in a live workspace: no telemetry initialization side effects (still `noop: true`) and app behavior unchanged from the pre-change baseline

## 10. Documentation and release

- [x] 10.1 Added a `CHANGELOG.md` entry (currently under `[6.53.0-beta.0]`) on the `6.x` branch describing the diagnostics metrics capability and the `DIAGNOSTICS_TELEMETRY_ENABLED` flag — update this entry once group 8 lands to mention that metrics are now actually wired into the request pipeline, not just available as a library API
- [ ] 10.2 Release a stable `6.x` version of `node-vtex-api` including this change, once group 8 is verified end-to-end on a test cluster
