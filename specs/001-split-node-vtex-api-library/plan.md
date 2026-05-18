# Implementation Plan: Split `node-vtex-api` into Public Library and Internal Runtime

**Branch**: `0001-split-node-vtex-api-library` | **Date**: 2026-05-15 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `specs/001-split-node-vtex-api-library/spec.md`

---

## Summary

Split today's single `@vtex/api` package into two independently-versioned, independently-released packages inside a monorepo:

- **`@vtex/api`** (lib, `packages/lib/`, first post-split version `8.0.0`) — the consumer-facing surface: `Service`, typed clients, `HttpClient`, error classes, logger, `MetricsAccumulator`, recorder, GraphQL helpers, tracer API, and the new **host-registry** functions through which the runtime injects platform configuration into lib's singletons.
- **`@vtex/api-runtime`** (runtime, `packages/runtime/`, first version `1.0.0`) — the Koa server, master/worker supervisor, request-pipeline middleware, telemetry transports. Shipped only inside `service-runtime-node`. No npm/peer dependency on lib; consumes lib **types** as a `devDependency` and lib **values** by resolving the consumer app's installed lib copy at process startup.

The split is mechanical: no method signature changes, no third-party dep bumps, no public-symbol semantics changes. The only visible API change in `@vtex/api@8.0.0` is the **removal of previously-leaked runtime internals** from `src/index.ts`.

Approach: stand up the monorepo, physically move `src/service/` boundaries per ADR-0001…0005 with one PR per architectural seam, introduce the **host registry** as the explicit runtime↔lib contract, then port and harden a contract test suite in the runtime package that gates lib promotion to the default install channel.

---

## Technical Context

**Language/Version**: TypeScript `^4.4.4` (`strict: true`) — locked by constitution principle V; bumping is out of scope.

**Primary Dependencies (lib)**: axios `^1.8`, graphql `^14`, opossum, dataloader, OpenTelemetry API, prom-client. Locked at current majors per Out of Scope §5.

**Primary Dependencies (runtime)**: Koa `^2`, jaeger-client, OpenTelemetry SDK + exporters, prom-client (registry only). Locked at current majors.

**Storage**: N/A (in-process caches + disk LRU under `~/.cache`; unchanged).

**Testing**: Jest `^25` + ts-jest in both packages. Lib tests stay colocated under `packages/lib/src/**/__tests__`. Runtime owns the **contract test suite** that asserts on the structural seam.

**Target Platform**: Node.js `>=8` per `engines.node` (constitution V); CI publish on Node `22`. Tightening either is a MAJOR change and is **not** done here — `@vtex/api@8.0.0`'s major bump is justified solely by the removal of leaked runtime internals.

**Project Type**: Monorepo of two npm libraries. Same git repo; no physical extraction.

**Performance Goals**: Telemetry-emission overhead introduced by the seam MUST remain within the diagnostics-spec budgets (span creation <100µs, context propagation <10µs, <5% CPU overhead) and MUST NOT regress against a pre-split baseline measured on a canary consumer app.

**Constraints**: Zero source-code change required of consumer apps using only the documented public API (SC-001). Zero bytes of Koa/master-worker/middleware in a consumer bundle (SC-003). 100% public-API precision against the manifest (SC-007).

**Scale/Scope**: ~hundreds of consumer apps across the platform; ~15k LOC in `src/` today; two packages after the split.

---

## Constitution Check

> All gates evaluated against `.specify/memory/constitution.md` v1.0.0.

| Principle | Status | Notes |
|---|---|---|
| **I. Public API is a contract** | ✅ Reinforced | The split exists *because* the current public API leaks internals. Lib's `packages/lib/src/index.ts` becomes the single explicit re-export list; runtime internals (Koa server, supervisor, middleware) are physically moved to `packages/runtime/` and become un-importable from `@vtex/api`. Public-API manifest check (SC-007) is a new CI gate. |
| **II. Semver is not optional** | ✅ Honored | Lib goes `7.x → 8.0.0` (MAJOR) precisely because the public surface shrinks. Runtime starts at `1.0.0`. `CHANGELOG.md` of `@vtex/api` lists every removed symbol with a supported alternative (FR-007). Runtime has its own `CHANGELOG.md`. |
| **III. Env access is bounded** | ✅ Honored | All existing `process.env.*` reads stay where they are (`src/constants.ts`, `src/service/`). The split **clarifies** the rule: lib has no business reading platform env vars; any new env read introduced by this work MUST land in the runtime package's bootstrap path. |
| **IV. Build output is deterministic** | ✅ Honored | Each package builds via its own `tsc`. The lib's `files: ["lib/", "gen/"]` is preserved. Runtime's `files` is scoped narrowly. `yarn ci:build` at the workspace root invokes both. The legacy `gen/` schema continues to ship with lib. |
| **V. Tests cover the public API** | ✅ Reinforced | Lib's existing colocated `__tests__` stay where they are. **New**: runtime owns a contract test suite (FR-014) — a separate test tree that asserts on the structural seam (Service.config shape, host-registry hooks, error duck-typing, log/metric/trace flow). This suite is the regression net for SC-006 (zero silent-contract-drift incidents). |
| **Operational: `prepublishOnly` lock** | ✅ Untouched | `scripts/publishLock.sh` continues to gate both packages. The new CI pipeline (lib → `next` dist-tag → runtime contract suite → promote to `latest`) is a CI-level concern, not a local-publish bypass. |
| **Operational: workflow file** | ✅ Untouched | `.github/workflows/publish-npm.yml` is duplicated/parameterised for the second package without altering its security-sensitive permissions. The skill is forbidden from touching it; that constraint is honored. |

**No violations. No complexity-tracking entries needed.**

---

## Architecture Summary

### Topology

```
node-vtex-api/                       (monorepo root)
├── packages/
│   ├── lib/                         → publishes @vtex/api@8.x
│   │   ├── src/                     ← moved from today's src/, minus service/server bits
│   │   │   ├── index.ts             ← explicit, audited re-export list (public API manifest)
│   │   │   ├── service/             ← only the public Service class + config types
│   │   │   ├── HttpClient/, clients/, caches/, errors/, utils/, typings/, metrics/, tracing/
│   │   │   └── hostRegistry/        ← NEW: register*/init* hooks (FR-011)
│   │   ├── lib/                     (build output, gitignored)
│   │   ├── gen/                     (yarn gen output, published)
│   │   └── package.json
│   └── runtime/                     → publishes @vtex/api-runtime@1.x
│       ├── src/
│       │   ├── server/              ← Koa bootstrap (moved from src/service/worker)
│       │   ├── supervisor/          ← master/worker lifecycle
│       │   ├── middleware/          ← request pipeline
│       │   ├── telemetry/           ← exporter wiring (Jaeger, OTLP, Prom registry)
│       │   ├── libBridge/           ← startup resolution of consumer app's lib copy
│       │   └── index.ts             ← runtime entry consumed by service-runtime-node
│       ├── tests/contract/          ← contract test suite (FR-014, FR-015)
│       └── package.json             ← devDependency: "@vtex/api": "workspace:*" (type-only)
├── docs/adr/                        (unchanged)
├── CONTEXT.md                       (unchanged)
└── package.json                     ← workspaces, root scripts, no runtime deps
```

**Workspace tool**: Yarn classic workspaces (no new tooling — Lerna/Nx/Turborepo are out of scope; Yarn 1 + per-package scripts is sufficient and respects constitution principle on minimal tooling).

### Runtime ↔ Lib seam (the contract)

Three parts, all documented in CONTEXT.md and ADR-0001…0003:

1. **`Service.config` shape** — runtime reads `routes`, `graphql`, `events`, `clients` off the consumer's `Service` instance, **structurally** (no `instanceof`).
2. **Host registry** — lib exports a small set of named `register*` / `init*` functions (logger transport, tracer exporter, recorder backend, metrics-accumulator flusher). Runtime calls them at startup. Lib provides safe defaults so unit tests and `vtex link` local development work without a runtime (FR-012).
3. **Duck-typed shapes** — errors (`name`, `statusCode`, `code`, `message`), log entries, metric entries. Cross-boundary objects MUST include correlation fields (`trace_id`, `span_id`, `account`, `workspace`, `operationId`) — these keys are part of the contract and asserted by the contract suite.

### Startup sequence (in `service-runtime-node`)

1. Container boots; runtime entry point runs.
2. Runtime resolves the consumer app's `@vtex/api` install path:
   `require.resolve('@vtex/api', { paths: [APP_PATH] })`.
3. Runtime value-loads lib **once** and grabs the canonical singleton refs (logger, tracer, recorder, MetricsAccumulator).
4. Runtime calls each host-registry hook with platform-injected config (credentials, endpoints, exporter targets).
5. Runtime `require()`s the consumer's compiled bundle, retrieves the default-exported `Service` instance, reads `service.config`, and wires Koa routes / GraphQL / events.
6. Server starts listening.

**Failure modes (FR-010)**: missing `@vtex/api` in app, lib version below `minLibVersion`, missing host-registry hook → fail-loud with a structured FATAL event carrying `exception.*` and `service.*` semconv attributes (NFR-O11y-004 below). No silent fallback to a bundled lib copy.

### Telemetry ownership (NFR-O11y-005)

- **Lib (consumer-app side) owns**: `service.name`, `service.version`, `service.instance.id` resource attributes; the `Logger`, `Tracer`, `Recorder`, `MetricsAccumulator` singleton implementations; all business-context attributes (`vtex.account`, `vtex.workspace`).
- **Runtime owns**: `host.*`, `process.*`, `k8s.*` resource attributes; the exporter wiring (OTLP / Jaeger / Prom registry); the W3C tracecontext + baggage propagation on the HTTP server boundary; the periodic flushers.

This ownership split is enforced by the host-registry surface — the runtime has no other channel to mutate lib's singletons.

---

## Non-Functional Requirements (Golden-Path Integration)

> O11y golden path: https://github.com/vtex/diagnostics (`docs/diagnostics-specification`)
> Skill: `sdlc-golden-path`. Earlier spec-stage review flagged 9 gaps; the
> ones that bind on the plan are addressed here.

- **NFR-O11y-001 (Parity)** — Telemetry emitted by an unchanged consumer app MUST be byte-equivalent (field names, semconv attributes, sampling) before and after upgrading to `@vtex/api@8.0.0` against the new runtime. Verified by the contract suite (FR-014) and by a canary diff against an unchanged consumer app.
- **NFR-O11y-002 (OTel conformance)** — Host-registry hooks accept/return OpenTelemetry-spec types. W3C Trace Context + Baggage propagation survives the runtime↔lib boundary.
- **NFR-O11y-003 (Correlation fields are contract)** — `trace_id`, `span_id`, `account`, `workspace`, `operationId` are required keys on cross-boundary log/metric entries. Asserted by the contract suite.
- **NFR-O11y-004 (Observable failure)** — Runtime startup failures emit a FATAL structured event with `exception.*` and `service.*` semconv attributes.
- **NFR-O11y-005 (Resource ownership)** — Resource attribute ownership split as above.
- **NFR-Perf-001 (No seam regression)** — Per-request latency and CPU overhead introduced by the split stay within the diagnostics-spec budgets, measured against a pre-split baseline on a canary consumer app.
- **NFR-Security: N/A** — packaging change; no new authn/authz or secret handling. FR-008 (runtime not in consumer bundle) is itself a supply-chain hygiene control and is enforced by the bundle-size CI check (workstream D below).
- **NFR-Resilience: N/A** — supervisor + image rollout unchanged (Out of Scope §4); the only new failure mode is startup resolution, addressed by FR-010 / NFR-O11y-004.
- **NFR-Privacy: N/A** — no PII flow changes.
- **NFR-Accessibility: N/A** — no UI surface.

---

## Workstreams

The work decomposes into six workstreams. They are sequenced (A → F) but B/C/D have internal parallelism. Each workstream lands as one or more PRs.

### A. Monorepo skeleton

Stand up `packages/lib/` and `packages/runtime/` with Yarn workspaces. Root `package.json` declares no runtime deps. Per-package `package.json`, `tsconfig.json`, `jest.config.js`, lint config. Root scripts (`yarn build`, `yarn test`, `yarn ci:build`, `yarn ci:test`) fan out to both packages. `gen/` continues to be produced inside `packages/lib/`. **No source moves yet — empty shells, green CI.**

### B. Move source to lib

Move today's `src/` wholesale into `packages/lib/src/`. Existing tests come with it. CI green on lib alone. **No public-API change yet** — `src/index.ts` is unchanged at the byte level. Constitution principle I is not yet enforced; this is a pure relocation.

### C. Carve runtime out of lib

Per ADR-0001…0003, move every runtime-internal module from `packages/lib/src/service/` to `packages/runtime/src/`:

1. Koa server bootstrap → `packages/runtime/src/server/`
2. Master/worker supervisor → `packages/runtime/src/supervisor/`
3. Request-pipeline middleware → `packages/runtime/src/middleware/`
4. Telemetry exporter wiring → `packages/runtime/src/telemetry/`

For each module: delete its re-export line from `packages/lib/src/index.ts`. Add it to the public-API removal manifest used by SC-007 and by the `@vtex/api@8.0.0` changelog (FR-007). Type-only imports in the runtime use `import type { … } from '@vtex/api'` (devDependency).

### D. Introduce the host registry (FR-011, FR-012, NFR-O11y-002/005)

In `packages/lib/src/hostRegistry/`, expose:

- `registerLoggerTransport(transport)` — runtime injects log shipping.
- `registerTracerExporter(exporter)` — runtime injects OTLP/Jaeger.
- `registerRecorderBackend(backend)` — runtime injects state store.
- `registerMetricsFlusher(flusher)` — runtime injects Prom-registry periodic dump.
- `initHostContext(ctx)` — runtime injects platform credentials + endpoints.

Lib's singletons get safe defaults: no-op transport, in-memory exporter, console fallback. Unit tests and `vtex link` work without a runtime present (FR-012).

Runtime's `libBridge/` performs the `require.resolve('@vtex/api', { paths: [APP_PATH] })` dance and calls each registry hook on startup. Failures → FATAL structured event (NFR-O11y-004).

### E. Contract test suite in runtime (FR-014, FR-015, NFR-O11y-001/003)

Author `packages/runtime/tests/contract/` covering:

1. **Service.config shape**: every documented `routes`/`graphql`/`events`/`clients` key.
2. **Host-registry hooks**: each `register*` / `init*` callable with valid arguments; structural acceptance of OTel-spec types (NFR-O11y-002).
3. **Error duck-typing**: a frozen list of error names + the fields the runtime reads on each.
4. **Log/metric/trace flow**: emit→export round-trip; assert OTLP payload semconv fields, including correlation IDs (NFR-O11y-003).
5. **Telemetry parity**: against a canary consumer app, diff OTLP output pre/post split (NFR-O11y-001).
6. **Perf budget**: micro-bench per-request seam overhead against budgets (NFR-Perf-001).

Suite is runnable against an **arbitrary published lib version** (FR-015) — installed transiently from npm by tag/version — so a `next`-tagged lib release candidate can be validated before promotion.

### F. Release-pipeline coordination (FR-016, FR-019)

CI changes (one PR, scoped to workflow YAML — **not** to `publish-npm.yml`, which is off-limits per constitution operational notes):

1. Lib release publishes to npm dist-tag `next` (not `latest`).
2. Runtime's contract suite runs against `@vtex/api@next` in CI.
3. On green, a separate `promote-lib` workflow re-tags `next` as `latest`.
4. Runtime release is independent: publish `@vtex/api-runtime` then bump pin in `service-runtime-node` (out of repo; tracked in this plan but executed by platform team).
5. Lib CI and runtime CI do not block each other (FR-019).

---

## Validation Checklist

Each item is a precondition for promoting lib to the `latest` dist-tag.

- [ ] **Public-API precision**: automated diff of `packages/lib/lib/index.d.ts` exports vs canonical manifest is empty in both directions (SC-007).
- [ ] **Consumer-app upgrade**: representative sample of ≥20 in-org consumer apps build, type-check, and pass tests against `@vtex/api@next` with no source-code change (SC-001).
- [ ] **Bundle audit**: a representative consumer app's shipped bundle contains zero bytes of Koa-server / supervisor / middleware code (SC-003).
- [ ] **Contract suite**: all categories in workstream E green against `@vtex/api@next`.
- [ ] **Observability parity**: OTLP diff against a canary consumer app is empty (NFR-O11y-001).
- [ ] **Observability conformance**: contract suite asserts on semconv fields + correlation IDs (NFR-O11y-003).
- [ ] **Performance budget**: seam overhead within diagnostics-spec budgets (NFR-Perf-001).
- [ ] **Failure observability**: startup-failure modes (FR-010) emit FATAL structured events (NFR-O11y-004).
- [ ] **Rollback drill**: in staging, runtime rollback returns all canary apps to prior behaviour within one pod-rotation window (SC-008).
- [ ] **Independent cadence smoke test**: a lib-only PR and a runtime-only PR each release end-to-end without triggering the other's pipeline (FR-017, FR-018).
- [ ] **CHANGELOG**: `@vtex/api@8.0.0` changelog lists every removed symbol + supported alternative (FR-007).

---

## Risk Log

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Silent contract drift between lib and runtime reaches production | M | High | `next`-dist-tag gate (workstream F) + contract suite (E). NFR-O11y-001 parity check is the strongest control. |
| R-2 | Consumer app reaches into a now-removed runtime internal | M | Medium | FR-007 changelog enumerates every removed symbol + alternative; lib's `8.0.0` major bump is precisely this signal. Type-error at consumer build is the desired failure mode. |
| R-3 | `instanceof` checks in consumer-app code on cross-boundary errors silently break | M | Medium | Document as a known incompatibility in the `@vtex/api@8.0.0` changelog with migration guidance to shape checks (`err.name === …`). Cannot be auto-detected at build time. |
| R-4 | Telemetry drift after the split (different attribute set, lost correlation IDs) | M | High | NFR-O11y-001 parity check + NFR-O11y-003 correlation-field assertions in the contract suite. Canary diff is the primary control. |
| R-5 | Seam adds measurable per-request overhead | L | Medium | NFR-Perf-001 budget check in CI. Hot-path reads (logger, tracer) cache the lib singleton refs at startup; no per-request resolution. |
| R-6 | `require.resolve` from the runtime picks an unexpected lib copy (e.g., hoisted dev copy) | L | High | FR-010 fail-loud diagnostic on resolution mismatch; runtime logs the resolved lib path + version on startup. |
| R-7 | Workspace tooling fights the existing Yarn-classic lockfile | L | Low | Use Yarn 1 workspaces; no migration to Yarn 3/4/pnpm/npm-workspaces in this work. |
| R-8 | CI publish workflow touched accidentally | L | High | `.github/workflows/publish-npm.yml` is off-limits per constitution operational notes; new pipeline lands in separate workflow files. |
| R-9 | Mixed-version cluster during runtime rollout breaks an app version | L | High | Edge-cases scenario in spec; contract suite runs against the prior runtime minor as well during the rollout window. |

---

## Out of Scope (reaffirmed)

Restated for the plan's reviewers — these remain explicitly **not** done as part of this work:

- Physical extraction of the runtime to a separate `node-vtex-runtime` repo.
- Renaming the lib package.
- Migrating any currently-supported public symbol off the public surface.
- Bumping any third-party major (Koa, GraphQL, axios, Jaeger, OpenTelemetry, prom-client).
- A long-term deprecation shim package.
- Migrating off TSLint, off Jest 25, off Yarn classic, or off `tsc`.
- Touching `.github/workflows/publish-npm.yml`.

---

## Phase Outputs

This plan does **not** produce `research.md`, `data-model.md`, `quickstart.md`, or `contracts/` files — none apply:

- **Research**: the architecture decisions are already captured in `CONTEXT.md` and `docs/adr/0001`–`0005`. No further research blocks this plan.
- **Data model**: there is no domain data model; the "entities" in the spec are packages and processes, already enumerated.
- **Quickstart**: each package will ship its own README and upgrade guide (FR-020). Authoring those is a task, not a plan-phase artifact.
- **Contracts**: the runtime↔lib contract is structural and is the deliverable of workstream E. Its formal definition lives in the contract test suite, not in a standalone `contracts/` directory.

Next: `/speckit.tasks` to break workstreams A–F into actionable tasks.
