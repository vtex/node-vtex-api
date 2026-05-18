---
description: "Task breakdown for splitting node-vtex-api into @vtex/api + @vtex/api-runtime"
---

# Tasks: Split `node-vtex-api` into Public Library and Internal Runtime

**Input**: `specs/001-split-node-vtex-api-library/spec.md`, `specs/001-split-node-vtex-api-library/plan.md`

**Prerequisites**: spec.md ✓, plan.md ✓. (No `research.md`, `data-model.md`, `quickstart.md`, or `contracts/` — see plan.md "Phase Outputs".)

**Tests**: Tests are **explicitly required** by FR-014/FR-015/FR-016 and constitution principle V. Contract tests gate lib promotion (`next` → `latest`).

## Format: `[ID] [P?] [Story] Description`

- **[P]** — Can run in parallel (different files, no deps on prior incomplete tasks).
- **[Story]** — `US1` (consumer apps keep working), `US2` (platform rolls runtime fixes alone), `US3` (independent release cadence). `[NFR]` = cross-cutting golden-path deliverable.
- Paths are repo-relative; the monorepo lives in this repo at `packages/lib/` and `packages/runtime/` per plan.md.

## Story → Workstream Map

| User Story | Backed by workstream(s) |
|---|---|
| **US1** (P1) Consumer apps keep working | C (carve runtime out), public-API manifest gate |
| **US2** (P1) Runtime fixes without consumer releases | D (host registry), runtime startup resolution |
| **US3** (P2) Independent release cadence | F (release pipeline), E (contract suite as gate) |
| **NFR** O11y + Perf golden paths | E (contract suite categories), telemetry parity canary |

---

## Phase 1: Setup (Shared Infrastructure — Workstream A)

**Purpose**: Stand up monorepo skeleton. No source moves, no behaviour changes. CI green on empty shells.

- [x] **T001** Add `workspaces: ["packages/*"]` to root `package.json`; remove root-level `main`/`typings`/`files`; keep root scripts that fan out (`yarn build`, `yarn test`, `yarn ci:build`, `yarn ci:test`, `yarn lint`, `yarn format`). _(commit `1c909ec1`; root renamed to `node-vtex-api-workspace`, marked `private: true`)_
- [x] **T002** Create `packages/lib/package.json` with `name: "@vtex/api"`, `version: "8.0.0-0"` (pre-release until promoted), `main: "lib/index.js"`, `typings: "lib/index.d.ts"`, `files: ["lib/", "gen/"]`, `engines.node: ">=8"`, `scripts: { build, watch, gen, test, lint, format, prepublishOnly }`, and `prepublishOnly` → `../../scripts/publishLock.sh`. _(commit `a186a69c`; placeholder `src/index.ts` added so `tsc` produces real output)_
- [x] **T003** Create `packages/runtime/package.json` with `name: "@vtex/api-runtime"`, `version: "1.0.0-0"`, `main: "lib/index.js"`, `typings: "lib/index.d.ts"`, `files: ["lib/"]`, `engines.node: ">=8"`, `devDependencies: { "@vtex/api": "workspace:*" }`, `scripts` mirroring lib, and `prepublishOnly` → `../../scripts/publishLock.sh`. _(commit `890c4508`; **deviation**: Yarn 1 does not support `workspace:*` protocol — used `"@vtex/api": "*"` instead; Yarn 1 workspaces still resolves it via symlink)_
- [x] **T004** [P] Add `packages/lib/tsconfig.json` and `packages/runtime/tsconfig.json` extending a shared `tsconfig.base.json` at the repo root (`strict: true`, `declaration: true`, `target/lib` matching today's). `packages/runtime/tsconfig.json` adds `paths` mapping `@vtex/api` → `../lib/src` for type-only resolution at build time. _(commit `7cb2a83d`; root `tsconfig.json` retained until Phase 2 retires it)_
- [x] **T005** [P] Add `packages/lib/jest.config.js` and `packages/runtime/jest.config.js`, both extending today's `jest.config.js` for `ts-jest` transform; lib's roots point to `<rootDir>/src`, runtime's roots include `<rootDir>/src` and `<rootDir>/tests/contract`. _(commit `3cc8fc34`; runtime's roots use `<rootDir>/tests` — `tests/contract/` lives underneath)_
- [x] **T006** [P] Copy `tslint.json` and `.prettierrc` into each package (or symlink to root via `extends`); keep `yarn lint` / `yarn ci:prettier-check` working at the root by fanning out. _(commit `318984a3`, empty; **decision**: no copies/symlinks — packages reference root configs via `../../tslint.json` and `../../.prettierrc` in their scripts, set in T002/T003)_
- [x] **T007** Move `scripts/publishLock.sh` to repo root (already there) and confirm both packages' `prepublishOnly` invoke it; do **not** touch `.github/workflows/publish-npm.yml` (constitution: off-limits). _(commit `59a3b164`, empty; verification only — file already at root, `prepublishOnly` wired in T002/T003)_
- [x] **T008** [P] Add root `.gitignore` entries: `packages/*/lib/`, `packages/*/coverage/`. Verify `packages/lib/gen/` is NOT gitignored (it ships). _(commit `e5049796`; **executed out of order before T002** — the existing `lib/` rule was matching `packages/lib/` itself; scoped to `/lib/` + `packages/*/lib/` + `packages/*/coverage/`)_
- [x] **T009** Update root `README.md` with a 1-paragraph "this is a monorepo of two packages" note; link to each package's README (to be written in later tasks). _(commit `1faccd81`)_
- [x] **T010** Verify CI: `yarn`, `yarn ci:build`, `yarn ci:test`, `yarn ci:prettier-check`, `yarn lint` all pass on the empty shells. _(commit `152df162`; fixed two pre-existing issues — `prettier` was never in root devDependencies, and Prettier 2.x errors on the unmatched `src/**/*.js` glob; dropped the `.js` part of the globs per constitution V TypeScript-only stance)_

**Checkpoint**: ✅ **DONE** — Workspaces exist, both packages build to `packages/*/lib/`, all five CI gates green. No public-API change yet. Phase 1 spans commits `1c909ec1`..`152df162` (+ prep commit `74e5d5d6` for SDD artifacts).

---

## Phase 2: Foundational — Move source to lib (Workstream B)

**Purpose**: Relocate today's `src/` wholesale into `packages/lib/src/`. **Byte-identical public API** at this stage — `@vtex/api`'s `index.d.ts` must be identical pre/post move.

**⚠️ CRITICAL**: All later work depends on this. Land as a single mechanical PR.

- [ ] **T011** `git mv src packages/lib/src` and `git mv __mocks__ packages/lib/__mocks__`. Move `gen/` → `packages/lib/gen/`. Move `docs/` references that point at `src/...` to `packages/lib/src/...` paths.
- [ ] **T012** Update `packages/lib/package.json` `scripts.gen` to write into `packages/lib/gen/`; update any `gen/`-writing script paths.
- [ ] **T013** [P] [NFR] Add a captured public-API snapshot: `packages/lib/tests/__public_api__/index.d.ts.snapshot` — verbatim copy of today's compiled `lib/index.d.ts` from `@vtex/api@7.x`. This is the **public-API manifest** referenced by SC-007 and by workstream C's removal list.
- [ ] **T014** [P] Add `packages/lib/tests/__public_api__/snapshot.test.ts` that compiles `packages/lib/src/index.ts` and asserts the emitted `.d.ts` exports are a **superset** of the snapshot at this point in time (will be tightened to equality in T030).
- [ ] **T015** Run `yarn ci:build` and `yarn ci:test` at the root; confirm lib's existing test suite passes unchanged.
- [ ] **T016** Diff `packages/lib/lib/index.d.ts` against the pre-move `@vtex/api@7.x` artifact; assert byte-identity. Land this PR only on a clean diff.

**Checkpoint**: Lib is at `packages/lib/`. Public surface unchanged. Runtime package still empty. **User stories cannot begin until here.**

---

## Phase 3: User Story 1 — Consumer apps keep working (Priority: P1) 🎯 MVP

**Goal**: Carve runtime-internal modules out of `@vtex/api`'s public surface, removing leaked symbols and bumping to `8.0.0`. After this story, US1 acceptance scenarios 1–3 pass.

**Independent test**: Bump a representative consumer app to `@vtex/api@next` (no source change) → it builds, type-checks, and its tests pass. The app's compiled bundle contains zero bytes of Koa/server/middleware (SC-003).

### Tests for User Story 1 (write first, ensure they FAIL)

- [ ] **T017** [P] [US1] Author `packages/lib/tests/__public_api__/removed-symbols.test.ts` — enumerates each runtime-internal symbol slated for removal (Koa server, supervisor, middleware classes, telemetry transport setup) and asserts `import('@vtex/api')` does **not** expose them. Will fail until workstream C completes.
- [ ] **T018** [P] [US1] Author `packages/lib/tests/__public_api__/preserved-symbols.test.ts` — asserts every documented public symbol from CONTEXT.md "Lib package" stanza (`Service`, `IOClients`, `HttpClient`, error classes, `Logger`, `MetricsAccumulator`, recorder, GraphQL helpers, tracer API, host-registry hooks) remains exported and type-resolvable.

### Implementation for User Story 1 (Workstream C — carve runtime out)

For each module group below, the recipe is: physically move sources to `packages/runtime/src/<area>/`; delete the corresponding re-export line from `packages/lib/src/index.ts`; rewrite internal callers in lib to drop the moved code paths; add removed names to the removal manifest used by T017 and by the CHANGELOG (T029).

- [ ] **T019** [US1] Move Koa server bootstrap (`packages/lib/src/service/worker/runtime/http/index.ts` and friends) → `packages/runtime/src/server/`. Drop server-related re-exports from `packages/lib/src/index.ts`. Lib no longer compiles a Koa-aware entry point.
- [ ] **T020** [US1] Move master/worker supervisor (`packages/lib/src/service/master/**`, `packages/lib/src/service/worker/index.ts`) → `packages/runtime/src/supervisor/`. Remove `Service.start()` runtime-only wiring from lib's `Service` class; `Service` becomes a pure config holder (CONTEXT.md "Service" stanza).
- [ ] **T021** [US1] Move request-pipeline middleware (`packages/lib/src/service/worker/runtime/{http,graphql,event}/middlewares/**`) → `packages/runtime/src/middleware/`. Drop middleware re-exports from `packages/lib/src/index.ts`.
- [ ] **T022** [US1] Move telemetry exporter wiring (Jaeger/OTLP/Prom registry plumbing in `packages/lib/src/tracing/` and `packages/lib/src/metrics/`) → `packages/runtime/src/telemetry/`. **Keep** `Tracer`, `MetricsAccumulator`, `Logger` singleton **implementations** in lib (per NFR-O11y-005 ownership split).
- [ ] **T023** [US1] Rewrite `packages/runtime/src/server/`, `supervisor/`, `middleware/`, `telemetry/` imports to use `import type { … } from '@vtex/api'` (devDependency, type-only — FR-004). Runtime MUST NOT have a value-level `import` from lib at this stage.
- [ ] **T024** [US1] Update `packages/lib/src/index.ts` to be an **explicit allow-list** of public re-exports (constitution principle I). Remove every wildcard re-export that previously pointed at a now-moved internal module. Each line is reviewed and intentional.
- [ ] **T025** [US1] Verify the lib build still emits the public surface for `Service`, `IOClients`, `HttpClient`, every error class, `Logger`, `MetricsAccumulator`, recorder, GraphQL helpers, tracer API. Run T018 → green.
- [ ] **T026** [US1] Run T017 → green. Every previously-leaked runtime internal is gone from `@vtex/api`'s `.d.ts`.
- [ ] **T027** [P] [US1] Pick 3 representative in-org consumer apps (one GraphQL-heavy, one event-handler, one public-route handler). For each: `yarn link @vtex/api` against `packages/lib/`, `yarn build`, run the app's existing tests. All three green with **zero source-code changes** in the consumer apps.
- [ ] **T028** [US1] Inspect the build output of one of the apps from T027; assert **zero bytes** of Koa-server / supervisor / middleware code (SC-003). Capture the byte counts in the PR description.
- [ ] **T029** [US1] Author `packages/lib/CHANGELOG.md` `## 8.0.0` entry: enumerate every removed symbol with a supported alternative (FR-007). Format: `Removed: <symbol>. Use <alternative> instead.`
- [ ] **T030** [US1] Tighten T014's snapshot test to **equality** against an updated `index.d.ts.snapshot` capturing the new (smaller) public surface. This becomes the SC-007 precision gate.

**Checkpoint**: `@vtex/api@8.0.0-rc.1` builds; public surface matches the audited manifest; consumer apps upgrade with no code change; runtime-internal symbols are gone. **US1 is independently shippable.**

---

## Phase 4: User Story 2 — Platform rolls runtime fixes alone (Priority: P1)

**Goal**: A runtime patch reaches production within one image roll, no consumer-app deploy required (SC-002). Requires the **host registry** (FR-011/012) and the runtime's **startup resolution** of the consumer app's lib copy.

**Independent test**: Stage a no-op runtime change (e.g., extra log line at request boundary). Bump `@vtex/api-runtime` patch → bump pin in `service-runtime-node` (staging) → deploy. Confirm the log line appears in consumer apps already running, with no consumer release.

### Tests for User Story 2 (write first, ensure they FAIL)

- [ ] **T031** [P] [US2] [NFR] Author `packages/runtime/tests/contract/host-registry.contract.test.ts` — asserts each of `registerLoggerTransport`, `registerTracerExporter`, `registerRecorderBackend`, `registerMetricsFlusher`, `initHostContext` exists on the resolved lib copy, is a function, accepts the documented argument shape, and the post-registration singleton emits via the registered transport/exporter (NFR-O11y-002).
- [ ] **T032** [P] [US2] [NFR] Author `packages/runtime/tests/contract/startup-resolution.contract.test.ts` — asserts: (a) given a fake app path with `@vtex/api` installed, the runtime resolves to that copy and logs the resolved path + version; (b) given a fake app path without `@vtex/api`, startup fails with a FATAL structured event carrying `exception.type`, `exception.message`, `service.name` (NFR-O11y-004); (c) given a fake app with a lib below `minLibVersion`, same FATAL event with `exception.code: "VTEX_API_LIB_TOO_OLD"`.
- [ ] **T033** [P] [US2] [NFR] Author `packages/runtime/tests/contract/error-shape.contract.test.ts` — for each documented error class (`UserInputError`, `ResolverError`, etc.), asserts `name`, `statusCode`, `code`, `message` are present and that runtime middleware reads them by shape (no `instanceof`).
- [ ] **T034** [P] [US2] [NFR] Author `packages/runtime/tests/contract/service-config-shape.contract.test.ts` — for a fixture `Service` instance, asserts the runtime can read `service.config.routes`, `service.config.graphql`, `service.config.events`, `service.config.clients` and wire them, treating absent keys as no-ops.

### Implementation for User Story 2

#### Host registry in lib (Workstream D)

- [ ] **T035** [US2] Create `packages/lib/src/hostRegistry/index.ts` exposing `registerLoggerTransport(t)`, `registerTracerExporter(e)`, `registerRecorderBackend(b)`, `registerMetricsFlusher(f)`, `initHostContext(ctx)`. Each writes into a module-scoped registry that lib's singletons read on emit.
- [ ] **T036** [US2] Refactor `packages/lib/src/service/logger/` to read its transport from the host registry; safe default = no-op transport that buffers up to N entries then drops (FR-012; unit tests + `vtex link` continue working without a runtime).
- [ ] **T037** [US2] Refactor `packages/lib/src/tracing/` to read its exporter from the host registry; safe default = in-memory exporter.
- [ ] **T038** [US2] Refactor `packages/lib/src/service/worker/runtime/utils/recorder.ts` (now in lib) to read its backend from the host registry; safe default = in-memory.
- [ ] **T039** [US2] Refactor `packages/lib/src/metrics/MetricsAccumulator.ts` to read its flusher from the host registry; safe default = no periodic flush.
- [ ] **T040** [US2] Add `registerLoggerTransport` and friends to the explicit re-export list in `packages/lib/src/index.ts` (T024). These are public; consumer apps may unit-test against them with stub transports.
- [ ] **T041** [P] [US2] [NFR-O11y-003] Ensure every cross-boundary entry shape (log record, metric entry, error envelope, span attributes) carries `trace_id`, `span_id`, `account`, `workspace`, `operationId` as documented keys. Update lib's emit paths to populate them from the current OTel context.

#### Runtime libBridge (Workstream D continued)

- [ ] **T042** [US2] Create `packages/runtime/src/libBridge/resolveLib.ts` — does `require.resolve('@vtex/api', { paths: [APP_PATH] })`, validates the resolved `package.json` has `version >= minLibVersion`, value-loads it once, caches the singleton refs. Failure cases throw `LibResolutionError` with structured fields consumed by T044.
- [ ] **T043** [US2] Create `packages/runtime/src/libBridge/registerAll.ts` — invokes each host-registry hook with platform config sourced from `packages/runtime/src/server/constants.ts` (env reads only here per constitution III).
- [ ] **T044** [US2] [NFR-O11y-004] Wire startup failures in `resolveLib.ts` / `registerAll.ts` to emit a FATAL structured event via the runtime's own bootstrap logger before `process.exit(1)`. Event carries `exception.type`, `exception.message`, `exception.stacktrace`, `service.name`, `service.version`, the resolved or attempted lib path.
- [ ] **T045** [US2] Wire `packages/runtime/src/server/` bootstrap to call `resolveLib` → `registerAll` → load the consumer's `Service` → start Koa. This is the runtime's `index.ts` entry consumed by `service-runtime-node`.

#### Make the US2 contract tests green

- [ ] **T046** [US2] Run T031–T034 → all green against `packages/lib/` via workspace resolution. Capture timing budgets for T031 (host registry path) and T034 (Service-config read) and confirm they're within NFR-Perf-001 budgets.
- [ ] **T047** [US2] Manual staging drill: produce a `@vtex/api-runtime@1.0.0-rc.1` tarball, install it into a `service-runtime-node` branch image, deploy to staging with an unchanged consumer app. Add a no-op log line in the runtime, publish `1.0.0-rc.2`, roll the image; verify the new log line appears in the consumer's output with no consumer-side action (US2 acceptance scenario 1).

**Checkpoint**: Runtime owns its release vehicle; consumer apps inherit fixes via pod rotation. **US2 is independently shippable** alongside US1.

---

## Phase 5: User Story 3 — Independent release cadence (Priority: P2)

**Goal**: Lib-only and runtime-only changes each release end-to-end without touching the other (FR-017/018/019, SC-004/005). Requires the **release-pipeline coordination** (Workstream F) and the **contract suite gate** (rest of Workstream E).

**Independent test**: Stage two PRs in parallel — one lib-only (new exported helper), one runtime-only (middleware reordering). Confirm each releases through its own pipeline without triggering the other's CI publish job.

### Tests for User Story 3 (write first, ensure they FAIL)

- [ ] **T048** [P] [US3] [NFR] Author `packages/runtime/tests/contract/telemetry-flow.contract.test.ts` — emit one log, one metric, one span through lib; assert the runtime's exporter receives OTLP payloads with the documented semconv fields (NFR-O11y-001 telemetry parity; NFR-O11y-003 correlation fields).
- [ ] **T049** [P] [US3] [NFR-Perf-001] Author `packages/runtime/tests/contract/perf-budget.bench.ts` — micro-bench per-request seam overhead (span creation, context propagation, structured-log emit). Fails if it regresses beyond diagnostics-spec budgets vs a `BASELINE.json` captured pre-split.
- [ ] **T050** [P] [US3] Author `packages/runtime/tests/contract/runner.ts` — CLI entrypoint that installs `@vtex/api@<version>` from the npm `next` (or arbitrary) dist-tag into a temp dir, then runs the entire `tests/contract/` suite against that copy (FR-015).

### Implementation for User Story 3 (Workstream F)

- [ ] **T051** [US3] Add `.github/workflows/lib-publish.yml` — on tag `lib-v*`, build `packages/lib/`, publish to npm with `--tag next`. **Do not modify** `.github/workflows/publish-npm.yml` (constitution: off-limits).
- [ ] **T052** [US3] Add `.github/workflows/runtime-publish.yml` — on tag `runtime-v*`, build `packages/runtime/`, publish `@vtex/api-runtime` to its registered registry. Independent of lib's workflow.
- [ ] **T053** [US3] Add `.github/workflows/contract-gate.yml` — triggered by `lib-publish.yml` success; checks out `packages/runtime/`, runs `node tests/contract/runner.ts --lib-version=$(npm view @vtex/api@next version)`. Sets a commit-status check `contract-gate`.
- [ ] **T054** [US3] Add `.github/workflows/lib-promote.yml` — manual `workflow_dispatch`; reads the `contract-gate` status for the candidate version; if green, retags `@vtex/api@<v>` from `next` to `latest`. If red, refuses.
- [ ] **T055** [US3] Add `.github/workflows/ci.yml` (or split into `lib-ci.yml` + `runtime-ci.yml`) that runs lib and runtime test suites **independently** — a failure in one MUST NOT block the other (FR-019). Use `paths:` filters so a lib-only PR doesn't trigger runtime CI and vice versa (this is the SC-004/005 measurement signal).
- [ ] **T056** [US3] Tag both pipelines' release events with a `coordination_required: true|false` JSON field (written to a small `releases-log.json` artifact). Six-month review of this artifact is the SC-004/005 measurement.
- [ ] **T057** [US3] Run T048, T049, T050 → green against the workspace lib copy.
- [ ] **T058** [US3] Dry-run the full release pipeline on a throwaway `next` version: `lib-publish.yml` → `contract-gate.yml` (green) → `lib-promote.yml`. Verify the candidate is on `latest` only after the gate passes.
- [ ] **T059** [US3] Independent-cadence smoke test: open one lib-only PR (touches only `packages/lib/**`) and one runtime-only PR (touches only `packages/runtime/**`). Verify each PR's CI exercises only its package's suite; verify each release path is independent (US3 acceptance scenarios 1 & 2).

**Checkpoint**: Both packages release independently; contract suite gates lib promotion. **US3 is shippable.**

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] **T060** [P] [NFR-O11y-001] Telemetry-parity canary: pick one production-shaped consumer app, run it against `@vtex/api@7.x` and against `@vtex/api@8.0.0-rc` for 60 minutes each in staging. Diff OTLP exporter output (logs, metrics, spans). Assert empty diff modulo expected `service.version` change.
- [ ] **T061** [P] Author `packages/lib/README.md` — public-API quick reference, link to `CHANGELOG.md`, link to `CONTEXT.md` and `docs/adr/` (FR-020/021).
- [ ] **T062** [P] Author `packages/runtime/README.md` — internal architecture, contract obligations, operational procedures, startup-resolution diagnostics (FR-020/021). Mark "platform engineers only".
- [ ] **T063** [P] Author `packages/lib/UPGRADE-7-to-8.md` — list every removed symbol + supported alternative, the `instanceof` migration guidance (edge case in spec), and the consumer-side verification recipe from T027.
- [ ] **T064** [NFR] Rollback drill (SC-008): on a staging cluster, roll runtime forward to `@vtex/api-runtime@1.0.0` then back to a `0.x` shim image; confirm all canary consumer apps return to prior runtime behaviour within one pod-rotation window (target <30 min).
- [ ] **T065** Run the full plan.md **Validation Checklist** (all 11 gates) and attach evidence to the promotion PR. Only proceed to `lib-promote.yml` once every box is checked.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no deps; start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1. **Blocks all user stories.**
- **Phase 3 (US1)**: depends on Phase 2.
- **Phase 4 (US2)**: depends on Phase 2; **does not depend on US1 finishing** — host registry can land before the public-API trim, but the US2 contract tests assert against the trimmed surface so they will only go green after T024–T026.
- **Phase 5 (US3)**: depends on Phases 3 and 4 (contract suite needs the host registry; release pipeline needs both packages publishable).
- **Phase 6 (Polish)**: depends on Phases 3–5 mostly complete.

### Within-story dependencies

- US1: T017/T018 (tests) → T019–T024 (carve) → T025/T026 (green) → T027/T028 (consumer-app validation) → T029 (changelog) → T030 (precision gate).
- US2: T031–T034 (tests) → T035–T041 (lib host registry) → T042–T045 (runtime libBridge) → T046 (green) → T047 (staging drill).
- US3: T048–T050 (tests) → T051–T056 (workflows) → T057 (green) → T058–T059 (drills).

### Parallel opportunities

- **Phase 1**: T004, T005, T006, T008 all [P].
- **Phase 2**: T013 + T014 [P]; rest is serial (single-PR mechanical move).
- **Phase 3**: T017 + T018 [P]; T027 runnable in parallel by 3 reviewers across 3 apps.
- **Phase 4**: T031–T034 all [P]; T036–T039 [P] (different files); T041 [P].
- **Phase 5**: T048–T050 all [P]; T051–T054 [P] within workflow files (different files).
- **Phase 6**: T060–T063 all [P].

### Cross-cutting NFR coverage

- O11y golden path → T013, T031–T034, T041, T044, T048, T060.
- Performance budget → T046, T049.
- Public-API precision → T013, T014, T017, T018, T030.
- Supply-chain (no runtime in bundle, FR-008) → T028.

---

## Implementation Strategy

### MVP (US1 only)

Phases 1 → 2 → 3 → 6 partial (T061, T063). Ship `@vtex/api@8.0.0` to the `next` dist-tag; do **not** promote to `latest` until US2's host registry exists, because consumer apps using the trimmed lib against the legacy runtime would silently lose the singletons that the runtime expected to find via the legacy module-scoped `let`s. Promotion to `latest` happens after Phase 4.

### Incremental delivery

1. Phase 1 + 2 → workspaces ready (no user-visible change).
2. Phase 3 → `@vtex/api@8.0.0-rc` on `next`; consumer-app drills (T027/T028).
3. Phase 4 → `@vtex/api-runtime@1.0.0-rc` in a `service-runtime-node` branch image; staging drill (T047).
4. Phase 5 → release pipelines live; promote lib to `latest`.
5. Phase 6 → polish, canary, rollback drill.

### Parallel team strategy

- Phase 1+2 done by one engineer (mechanical, serial-ish).
- Phase 3 (US1): one engineer per workstream-C module (T019/T020/T021/T022 in parallel, four engineers).
- Phase 4 (US2): one engineer on the host registry refactor (T035–T040), one on the runtime libBridge (T042–T045).
- Phase 5 (US3): one engineer on workflows.
- Phase 6: distributed.

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependencies — they can run on different machines/PRs.
- Tests are written before implementation in each story phase; CI failure is the expected starting state.
- Commit per task or per logical group; squash at PR merge.
- Promotion to npm `latest` is gated by **every** box in plan.md "Validation Checklist" being green (T065).
- Anything not listed here — runtime physical extraction, package renames, third-party major bumps, deprecation shims, workflow edits to `publish-npm.yml`, tooling migrations — is **explicitly out of scope** per plan.md and spec.md.
