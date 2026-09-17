## Context

`node-vtex-api@6.x` and `master` (`7.x`) have diverged on telemetry:

- **`6.x` today**: `src/service/telemetry/client.ts` is a `TelemetryClientSingleton` that calls `NewTelemetryClient(...)` once and hands back a single raw `TelemetryClient`. Its only consumer is `src/service/logger/client.ts`, which uses it purely to export structured logs. It depends on `@vtex/diagnostics-nodejs@0.1.0-beta.10`. There is no metrics client, no `DiagnosticsMetrics` API, no semantic-conventions package, no auto-instrumentation.
- **`master` today**: the same singleton pattern was extended into three clients (`newTracesClient`, `newMetricsClient`, `newLogsClient`) built from `@vtex/diagnostics-nodejs@0.1.8-io`, sharing `getClusterResourceAttributes()` for resource attribution, registering `KoaInstrumentation` and `HostMetricsInstrumentation`, and exposing metrics to app/library code through `src/metrics/DiagnosticsMetrics.ts` (histogram-based latency recording, counters, gauges, and OTel-context-scoped "base attributes" merged into every call). Feature activation is gated by `DIAGNOSTICS_TELEMETRY_ENABLED`.

This was withheld from `6.x` because of a build-time constraint, not a design constraint: `builder-hub` runs `node: 6.x` app builds (including its own — `builder-hub`'s manifest declares `"builders": {"node": "6.x"}`) on the `service-runtime-node@6.x` runtime image, which is `node:16.20.2`. Historically, `yarn install` for `major < 7` builds forked directly from that Node 16 process. When `master`'s diagnostics dependency tree grew, there was no verified path to install it reliably under that process for arbitrary app dependency trees, so 7.x got an escape hatch instead (`service-runtime-node@6.41.0` ships an extra `node20` binary in the same 6.x-branch image; `builder-hub`'s `NodeBuilder`/`yarn.ts` spawns it only when `nodeBuilderMajor >= 7`).

A dependency audit (done as part of scoping this change) resolved every `package.json` under `@vtex/diagnostics-nodejs@0.1.8-io`, `@vtex/diagnostics-semconv@5.5.2`, and the full `@opentelemetry/*` tree it pulls in (36 packages) plus `@grpc/*`. The highest `engines.node` floor found is `>=14` (`@opentelemetry/api` is `>=8`); nothing requires Node 18+, nothing needs native compilation (`@grpc/grpc-js` ships prebuilt, pure-JS), and nothing is ESM-only. Node 16.20.2 — what `builder-hub` and hosted `6.x` apps already run on — clears every floor in the tree. This removes the original blocker: the port can proceed without touching `builder-hub` or `service-runtime-node`.

## Goals / Non-Goals

**Goals:**
- Bring `DiagnosticsMetrics` (latency histogram, counters, gauges, request-scoped base attributes) to `node-vtex-api@6.x`, at parity with `master`'s current public API.
- Bring the split traces/metrics/logs `TelemetryClientSingleton`, cluster resource attributes, and Koa + host-metrics auto-instrumentation to `6.x`.
- Ship the feature dark (`DIAGNOSTICS_TELEMETRY_ENABLED=false` by default) so existing `6.x` apps see no behavior change until explicitly opted in.
- Keep the existing `6.x` structured-logging consumer of the telemetry client working unchanged through the rewrite.

**Non-Goals:**
- No changes to `builder-hub` or `service-runtime-node` — the dependency audit shows none are required.
- No porting of the `HeaderKeys`/`AttributeKeys` constants refactor from `master`'s `constants.ts` beyond what `AttributeKeys` diagnostics needs (`VTEX_IO_CLUSTER_ID`, `VTEX_IO_CLUSTER_ROLE`, etc.) — that refactor is unrelated cleanup and stays out of scope.
- No attempt to reconcile `6.x` and `master`'s `DiagnosticsMetrics` implementations into a shared package — this is a straight backport, duplication across branches is accepted (consistent with how `node-vtex-api` already maintains divergent major-version branches).
- No new capability surface beyond what `master` already exposes — this change ports existing behavior, it doesn't design new metrics APIs.

## Decisions

**Port `master`'s implementation as-is rather than redesigning.** `DiagnosticsMetrics.ts`, `resourceAttributes.ts`, and the split-client shape of `telemetry/client.ts` are stable, tested, and already running in production on `7.x`. Re-deriving them for `6.x` risks behavioral drift between branches for what should be the same feature. The only intentional deviations are the ones required by `6.x`'s existing shape (e.g., `6.x`'s logger already calls `getTelemetryClient()` expecting *a* client back — that call site is adapted to pull `logsClient` from the new multi-client shape rather than rewriting the logger).

**Bump `@vtex/diagnostics-nodejs` directly from `0.1.0-beta.10` to `0.1.8-io`, not incrementally.** `6.x`'s current usage surface (`NewTelemetryClient`, `TelemetryClient` type) is narrow enough that reviewing the target version's changelog/breaking changes once, at the version already proven on `master`, is lower-risk than bisecting through intermediate betas that were never shipped to a stable consumer.

**Gate the entire feature behind `DIAGNOSTICS_TELEMETRY_ENABLED`, matching `master`.** Reusing the existing flag (rather than inventing a `6.x`-specific one) keeps operational tooling (dashboards, rollout scripts, on-call runbooks) that already understands this flag from `7.x` valid for `6.x` too.

**Treat the jest mock for `@vtex/diagnostics-nodejs` as part of this change, not a follow-up.** `6.x` already carries a stub shaped for the old single-client API (added under `test(jest): stub @vtex/diagnostics-nodejs so metrics suites load under jest@25`); it must be updated to the `Exporters`/`Instrumentation`/multi-client shape `master`'s test suite mocks, or the new tests (ported alongside the implementation) won't load.

## Implementation Addenda

Two decisions were made during implementation that this document didn't anticipate:

1. **`TelemetryClientSingleton` exposes a `getTelemetryClient()` getter for the raw `@vtex/diagnostics-nodejs` `TelemetryClient`, in addition to `master`'s three pre-built clients.** `6.x`'s structured logger builds a *dynamic* per-request logs client (`newLogsClient()` with a loggerName derived from `account`/`workspace`/`appName` passed at call time), which `master`'s fixed-at-init three-client shape doesn't support. Exposing the raw client lets the logger keep this exact behavior with zero changes to its call site or public signature — the only diff is what backs `getTelemetryClient()` internally. Confirmed with the user before implementing (see conversation).
2. **jest's bundled resolver (jest 25) doesn't support `package.json` "exports" maps**, so `@opentelemetry/otlp-exporter-base/node-http` — a subpath pulled in transitively by the diagnostics dependency bump — failed to resolve under tests even though Node's own runtime `require()` resolves it fine. Fixed with a `moduleNameMapper` entry in `jest.config.js` pointing straight at the package's build output. This is a test-infrastructure-only fix; it doesn't affect the engines/Node-version analysis above, which is about production runtime resolution, not jest's resolver.

Additionally, the `@vtex/diagnostics-nodejs` version bump surfaced a real breaking change not previously visible from the outside: `Exporters.CreateLogsExporterConfig`'s `ExporterOptions` type dropped `path`, `protocol`, and `headers` between `0.1.0-beta.10` and `0.1.8-io`. `6.x`'s logger passed all three; they were removed to match the new type (matching `master`'s simpler usage, which only ever passed `endpoint`).

## Risks / Trade-offs

- **[Risk]** `@vtex/diagnostics-nodejs` jumped from a `0.1.0` beta to `0.1.8-io` — an 8-patch, beta-to-"io"-tagged gap whose changelog hasn't been reviewed line-by-line yet. → **Mitigation**: review the package's changelog/tags between the two versions as an explicit task before wiring the new client shape; since `master` already runs `0.1.8-io` in production, any incompatibility surfaces as a diff against known-working behavior, not unknown territory.
- **[Risk]** Every app on the `node: 6.x` builder gains these dependencies transitively (larger `node_modules`, more install time), even for apps that never enable `DIAGNOSTICS_TELEMETRY_ENABLED`. → **Mitigation**: the dependency audit confirms no install-time failure risk (engines, no native builds); the cost is disk/time, not correctness, and is already accepted on `7.x` today.
- **[Risk]** `builder-hub`'s own runtime is Node 16.20.2 today, but that's inferred from the `service-runtime-node` `6.x` branch's `Dockerfile`, not from a live deployment check. If the pinned production image ever diverges from that branch, the "Node 16 clears `>=14`" conclusion still holds unless production somehow regresses below Node 14 — considered very unlikely but not independently verified against the live cluster. → **Mitigation**: no action required given the margin (14 vs. 16), but flagged as an assumption for whoever owns the `builder-hub` deploy pipeline to confirm if they want extra certainty.
- **[Trade-off]** Keeping `6.x` and `master`'s diagnostics code as parallel, duplicated implementations (per Non-Goals) means future diagnostics changes must be ported twice. Accepted because `node-vtex-api` already operates this way across its major-version branches.

## Migration Plan

1. Land the dependency bump and telemetry/metrics port on `6.x` with `DIAGNOSTICS_TELEMETRY_ENABLED` defaulting to off (matching `master`'s rollout pattern) — no consumer app sees any behavior change on upgrade.
2. Validate against a small set of `6.x` apps in a non-production workspace with the flag manually enabled, confirming metrics land in the same backend `master`-based apps report to.
3. Roll out the `6.x` `node-vtex-api` version bump to consumer apps at their own pace (standard dependency bump, no forced migration).
4. Enable `DIAGNOSTICS_TELEMETRY_ENABLED` for interested `6.x` apps individually; no fleet-wide flip is required or planned as part of this change.
5. **Rollback**: reverting the `node-vtex-api@6.x` version bump in a consumer app fully reverts behavior — the change is additive and flag-gated, so no data migration or cleanup is needed on rollback.

## Open Questions

- Does anyone need `6.x`'s `DiagnosticsMetrics` API to diverge from `master`'s (e.g., different default histogram buckets, different max custom-attribute limit) given `6.x` apps may have different traffic/cardinality profiles, or is exact parity the right target?
- Should the `@vtex/diagnostics-nodejs` changelog review (Risk 1) block this change's merge, or can it happen as a fast-follow given `master` already validates the target version in production?
