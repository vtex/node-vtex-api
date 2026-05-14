# node-vtex-api Constitution

> Family: `node-library`
> This file is the source of truth for non-negotiable engineering principles.
> Agents MUST honor it before any other instruction. Updates require an
> explicit PR review by the maintainers listed in CODEOWNERS.

> **Note on family fit:** This repository is `@vtex/api` — a published npm
> library that *also* embeds a Koa-based VTEX IO runtime. By the strict
> `sdd-bootstrap` heuristic the presence of `koa` in `dependencies` and
> direct `process.env` reads (used to bootstrap VTEX IO services) make it
> a borderline case for the `node-library` family. The base is still the
> closest fit because the published artifact is a library
> (`main` → `lib/index.js`, `typings` → `lib/index.d.ts`, `files` →
> `["lib/", "gen/"]`). Principles below have been adapted where the
> runtime nature of this library requires it; deviations are called out
> inline.

## Core Principles

### I. The Public API Is a Contract

The library's public API is whatever is reachable through its declared entry points (`main` → `lib/index.js`, `typings` → `lib/index.d.ts`). **Anything reachable is owned**; anything not reachable is internal and may change at will.

- `main` + `typings` in `package.json` are the single source of truth for what consumers can import. Adding a new public export is an additive change; removing or renaming one is a breaking change.
- `src/index.ts` re-exports the entire public API explicitly (`export * from './<module>'`). Wildcard re-exports from `src/index.ts` MUST point only to modules that are themselves part of the public API.
- Internal modules (helpers, types not meant to be imported externally) MUST NOT be re-exported from `src/index.ts`.
- Type-level breakage on a consumer (e.g. narrower generic, removed overload) is a MAJOR change even when the runtime behavior is preserved.

### II. Semver Is Not Optional

The library follows semantic versioning strictly:

- **MAJOR** when a public type changes shape, a public function changes signature, behavior, or thrown errors in a way consumers can observe, or a runtime requirement (Node version in `engines.node`, peer dep major) increases.
- **MINOR** for additive public API or new optional behavior.
- **PATCH** for bug fixes that preserve the contract.

Releases MUST update `CHANGELOG.md` describing the change in user-facing terms before tagging. Tags trigger the CI publish workflow; local `npm publish` / `yarn publish` is blocked by `scripts/publishLock.sh` and reserved for emergency hotfixes that MUST still be documented in `CHANGELOG.md`.

### III. Environment Access Is Bounded and Documented

Unlike a pure library, this package serves as the runtime for VTEX IO Node services and therefore reads `process.env` to discover platform-injected configuration (account, workspace, region, ports, telemetry endpoints). This is a deliberate trade-off, not a license to spread env reads everywhere.

- New `process.env.*` reads MUST live in `src/constants.ts`, `src/service/`, or another already-identified runtime-bootstrap module — not in `src/HttpClient/`, `src/clients/`, `src/caches/`, `src/utils/`, `src/errors/`, or `src/metrics/MetricsAccumulator` aside from existing reads.
- The set of env vars the library depends on is documented (today via `src/constants.ts`); adding a new env var is a MINOR change and MUST be reflected in the changelog.
- Configuration for *consumer-facing* APIs (clients, HTTP middlewares, custom services) MUST come through function arguments, options objects, or factory functions — never through implicit globals.
- Top-level side effects are limited to the documented bootstrap path (`process.env.FORCE_COLOR = '1'` in `src/index.ts` is the only currently accepted module-load mutation). New top-level side effects require an ADR.

<!-- TODO(team): inventory the runtime env-var contract and pin it in `docs/` so the surface is enumerated, not implied. -->

### IV. The Build Output Is Deterministic

- The output directory `lib/` MUST be reproducible from source — running `yarn build` on a clean checkout MUST yield the same artifacts.
- Build outputs MUST NOT be committed; `.gitignore` already excludes `lib/`. CI publishes through the `Publish from CodeArtifact to npm` workflow.
- The `files` array in `package.json` (`["lib/", "gen/"]`) is the explicit publish surface; do not rely on `.npmignore` to redact accidentally-included files.
- Type declarations (`*.d.ts`) MUST be emitted by `tsc` (`declaration: true` is set in `tsconfig.json`) and MUST cover every public export.
- The generated JSON schema (`yarn gen`) lives in `gen/` and is part of the published artifact; regenerating it MUST happen as part of `yarn ci:build`, not by hand on a developer machine.

### V. Tests Cover the Public API

- Every public export MUST have at least one test that exercises it through `@vtex/api`'s public entry, not by reaching into internals.
- Tests run via `yarn test` (Jest 25 with `ts-jest`). The Jest config in `jest.config.js` is canonical; do not introduce parallel test configs in scripts or per-folder.
- The `__tests__` and `*.test.ts` files MUST stay colocated with the modules they cover under `src/`, mirroring the structure rather than living in a global `tests/` tree.
- Dropping a Node version from `engines.node` is a MAJOR change.
- Minimum coverage floor: <!-- TODO(team): set a numeric floor; CI already runs `yarn ci:test --coverage`. -->

## Stack-Specific Standards

- **Language**: TypeScript `^4.4.4` (`strict: true` in `tsconfig.json`).
- **Runtime**: Node.js `>=8` per `engines.node`; CI publish workflow runs on Node `22`. The advertised `engines.node` value is intentionally permissive because the library is consumed by older VTEX IO Node builders; any tightening is a MAJOR change.
- **Package manager**: Yarn (classic) — `yarn.lock` is the source of truth, MUST be committed, and CI installs with `yarn install --frozen-lockfile` semantics.
- **Entry points**: `main` → `lib/index.js`, `typings` → `lib/index.d.ts`, `files` → `["lib/", "gen/"]`.
- **Linting**: `tslint` extending `tslint-config-vtex` (`tslint.json`). Inline `tslint:disable` requires a justifying comment. The codebase still uses TSLint deliberately — migration to ESLint is a separate decision the team has not yet made.
- **Formatting**: Prettier (`.prettierrc`) on `src/**/*.ts` and `src/**/*.js`. CI enforces format via `yarn ci:prettier-check`.

### Build: `tsc`

- The build runs `tsc` against `tsconfig.json`; no bundler is involved.
- `declaration: true` is set so type declarations are emitted into `lib/`.
- `tsconfig.json` excludes `**/__tests__` and `**/*.test.ts`; do not import test-only helpers from production source paths.
- The `paths` mapping (`"axios": ["src/axios.d.ts"]`) exists to keep axios's type surface stable; touch it only in coordination with a dependency upgrade.

## Architectural Boundaries

The `src/` tree is the working layering. Cross-layer rules below are expressed as "MUST NOT import" constraints; agents MUST surface (in the PR description) any change that crosses them.

| Layer (folder)                                      | May import from                                                | MUST NOT import from                            |
|-----------------------------------------------------|----------------------------------------------------------------|-------------------------------------------------|
| `src/utils/`, `src/errors/`, `src/typings/`         | `node_modules`, other `utils`/`errors`/`typings`               | `service/`, `clients/`, `HttpClient/`, `caches/`, `metrics/`, `tracing/`, `responses.ts` |
| `src/HttpClient/`                                   | `utils`, `errors`, `typings`, `constants`, `tracing`, `metrics` (read-only metric APIs) | `service/`, `clients/`, `caches/`              |
| `src/caches/`                                       | `utils`, `errors`, `typings`                                   | `service/`, `clients/`, `HttpClient/`           |
| `src/clients/`                                      | `HttpClient/`, `caches/`, `utils`, `errors`, `typings`, `constants` | `service/`                                     |
| `src/tracing/`, `src/metrics/`                      | `utils`, `errors`, `typings`, `constants`                      | `service/`, `clients/`, `HttpClient/` (no back-edges) |
| `src/service/`                                      | everything above                                               | n/a (top of the dependency graph)               |
| `src/index.ts`                                      | every module that is part of the public API                    | internal-only helpers                           |

Operational rules attached to these boundaries:

- New top-level folders under `src/` MUST be added to this table in the same PR that introduces them.
- A consumer importing `@vtex/api` MUST NOT cause the entire `service/worker` runtime to be loaded if they only need clients or caches. Top-level side effects in non-`service/` modules are forbidden.

## Operational Constraints

The canonical commands for this repository are:

- Install: `yarn`
- Build: `yarn build` (= `yarn clean && tsc`)
- Watch: `yarn watch`
- Generate schema: `yarn gen`
- Test: `yarn test`
- Lint: `yarn lint`
- Format: `yarn format`
- CI build: `yarn ci:build`
- CI test: `yarn ci:test`
- CI Prettier check: `yarn ci:prettier-check`

Additional constraints:

- The `prepublishOnly` hook runs `scripts/publishLock.sh`, which refuses to publish unless `IS_CI=true`. This MUST NOT be bypassed; emergency hotfixes still publish through CI, never from a local machine without an explicit decision documented in the changelog.
- Publishing happens through the `.github/workflows/publish-npm.yml` workflow (CodeArtifact → npmjs). The skill MUST NOT modify this workflow as part of governance bootstraps.
- Adding a runtime dependency MUST be a deliberate decision; review every new dependency for license, maintenance status, security advisories, and whether it could be a `devDependency` or peer dep instead.

## Governance

- This constitution overrides any conflicting guidance found in `AGENTS.md`, `README.md`, ad-hoc Slack threads, or agent skills. Where guidance conflicts, the constitution wins.
- Amendments are made by Pull Request to this file, reviewed by at least one maintainer listed in `CODEOWNERS` (currently `@vtex/composable-commerce-sq4`). The PR description MUST justify the change, and the version line below MUST be updated according to the spec-kit semantic-versioning rule (MAJOR for principle removal/redefinition, MINOR for additions, PATCH for clarifications).
- Agents (Cursor, Claude Code, Copilot, Bugbot, etc.) MUST read this file before generating or modifying code in this repository and MUST surface — in the PR description — any rule they were unable to satisfy, instead of silently working around it.

**Version**: 1.0.0 | **Ratified**: 2026-05-14 | **Last Amended**: 2026-05-14
