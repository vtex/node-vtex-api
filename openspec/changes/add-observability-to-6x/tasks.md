Each numbered group below follows red → green → refactor: write the failing spec-derived tests first, implement the minimum to pass them, then refactor with tests green throughout. No implementation task should be started before its preceding test task is committed and failing for the right reason.

## 1. Setup (prerequisite for any red test to run)

- [ ] 1.1 Review the `@vtex/diagnostics-nodejs` changelog/tags between `0.1.0-beta.10` and `0.1.8-io` for breaking changes affecting `NewTelemetryClient`/`TelemetryClient` usage
- [ ] 1.2 Bump `@vtex/diagnostics-nodejs` to `0.1.8-io`, add `@vtex/diagnostics-semconv@5.5.2` and `@opentelemetry/{api,host-metrics,instrumentation,instrumentation-koa}` to `package.json` (versions pinned to `master`), then `yarn install` and confirm no engine warnings/failures on the `6.x` branch
- [ ] 1.3 Update the `@vtex/diagnostics-nodejs` jest mock to expose `Exporters`, `Instrumentation`, `Logs`, `Metrics`, `Traces`, and `NewTelemetryClient`, matching the shape `master`'s test suite mocks — without this, every red test below fails on module resolution rather than on the intended assertion
- [ ] 1.4 Add `AttributeKeys` (from `@vtex/diagnostics-semconv`), `CLUSTER_ID`, `CLUSTER_ROLE`, `METRIC_CLIENT_INIT_TIMEOUT_MS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `DIAGNOSTICS_TELEMETRY_ENABLED` to `src/constants.ts`, matching `master`'s definitions (the `HeaderKeys` refactor stays out of scope)

## 2. Cluster resource attributes

- [ ] 2.1 **Red**: write `src/service/telemetry/resourceAttributes.test.ts` covering the four scenarios under "Cluster resource attributes on emitted telemetry" (both present, one missing, whitespace-only, both absent); confirm it fails because `getClusterResourceAttributes` does not exist yet
- [ ] 2.2 **Green**: implement `src/service/telemetry/resourceAttributes.ts` (`getClusterResourceAttributes`) to make all four scenarios pass
- [ ] 2.3 **Refactor**: clean up trimming/emptiness logic once green; re-run tests after each edit

## 3. Split telemetry client (traces/metrics/logs)

- [ ] 3.1 **Red**: write `src/service/telemetry/client.test.ts` covering "Split traces, metrics, and logs telemetry clients" (independent init, caching, concurrent in-flight init, `reset()`) using the updated mock from 1.3; confirm it fails against the current single-client `TelemetryClientSingleton`
- [ ] 3.2 **Red**: extend the same test file (or add a focused test) for "Existing structured logging keeps working" — assert `src/service/logger/client.ts` still exports logs correctly once it depends on the new shape; confirm it fails before the logger is updated
- [ ] 3.3 **Green**: rewrite `src/service/telemetry/client.ts` into the split `TelemetryClientSingleton` (`newTracesClient`/`newMetricsClient`/`newLogsClient`, `getTelemetryClients()`, `reset()`) to pass 3.1
- [ ] 3.4 **Green**: update `src/service/logger/client.ts` to pull the logs client from `getTelemetryClients()` to pass 3.2
- [ ] 3.5 **Refactor**: extract shared exporter-config construction if duplicated across the three client initializers; keep 3.1–3.2 green throughout
- [ ] 3.6 Confirm `src/service/telemetry/index.ts` exports the shape both the logger and the new metrics client need

## 4. Auto-instrumentation (Koa + host metrics)

- [ ] 4.1 **Red**: extend `src/service/telemetry/client.test.ts` with the two scenarios under "Automatic Koa and host metrics instrumentation" (Koa instrumentation registered, host metrics collection started); confirm it fails before instrumentation is wired in
- [ ] 4.2 **Green**: register `KoaInstrumentation` and `HostMetricsInstrumentation` during telemetry client initialization to pass 4.1
- [ ] 4.3 **Refactor**: confirm instrumentation registration is skipped cleanly when telemetry is disabled (ties into group 7), without duplicating the enablement check

## 5. `DiagnosticsMetrics`: latency, counters, gauges

- [ ] 5.1 **Red**: write `src/metrics/DiagnosticsMetrics.test.ts` covering "Latency recording via a shared histogram" (hrtime conversion, raw milliseconds, not-ready no-op) and "Named counters and gauges" (create-on-first-use, reuse, not-ready no-op); confirm it fails because `DiagnosticsMetrics` does not exist yet
- [ ] 5.2 **Green**: implement `src/metrics/DiagnosticsMetrics.ts` with `recordLatency`, `incrementCounter`, `setGauge`, and the shared histogram/counter-map/gauge-map to pass 5.1
- [ ] 5.3 **Refactor**: extract `hrtimeToMillis` and the not-ready guard if duplicated across methods

## 6. `DiagnosticsMetrics`: base attributes and cardinality limiting

- [ ] 6.1 **Red**: extend `src/metrics/DiagnosticsMetrics.test.ts` with "Request-scoped base attributes" (merge, precedence, no-scope, no-leak-after-scope-ends) and "Custom attribute cardinality limiting" (within limit, exceeding limit, warning in linked context, no warning outside it, base attributes uncounted); confirm it fails before `runWithBaseAttributes`/limiting exist
- [ ] 6.2 **Green**: implement `runWithBaseAttributes` (OTel context propagation), `mergeAttributes`, and `limitCustomAttributes` (limit of 7) to pass 6.1
- [ ] 6.3 **Refactor**: consolidate the merge/limit pipeline used by all three metric methods

## 7. Feature flag gating

- [ ] 7.1 **Red**: write a test (e.g. `src/service/telemetry/featureFlag.test.ts` or an addition to `client.test.ts`) covering "Flag disabled (default)", "Flag explicitly set to a falsy value", and "Flag enabled"; confirm it fails before the gate is wired into client initialization / instrumentation registration
- [ ] 7.2 **Green**: gate telemetry client initialization and instrumentation registration behind `DIAGNOSTICS_TELEMETRY_ENABLED` to pass 7.1
- [ ] 7.3 **Refactor**: ensure the gate is checked in exactly one place rather than duplicated across traces/metrics/logs/instrumentation setup

## 8. Full-suite regression and manual verification

- [ ] 8.1 Run the complete `6.x` jest suite; confirm no regressions in tests outside this change's scope
- [ ] 8.2 Manually verify in a non-production workspace with `DIAGNOSTICS_TELEMETRY_ENABLED=true`: metrics/traces/logs clients initialize, Koa/host-metrics instrumentation registers, and `DiagnosticsMetrics` calls emit data to the configured OTLP endpoint
- [ ] 8.3 Manually verify with the flag unset: no telemetry initialization occurs and app behavior is unchanged from the pre-change baseline

## 9. Documentation and release

- [ ] 9.1 Add a `CHANGELOG.md` entry on the `6.x` branch describing the new diagnostics metrics capability and the `DIAGNOSTICS_TELEMETRY_ENABLED` flag
- [ ] 9.2 Release a new `6.x` version of `node-vtex-api` including this change
