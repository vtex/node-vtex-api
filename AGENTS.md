# AGENTS.md — node-vtex-api

## Project Overview

`@vtex/api` is the VTEX IO API client library and embedded runtime for VTEX IO Node services. Consumers `import { Service, ... } from '@vtex/api'`, declare their clients and routes, and the library boots a Koa-based runtime under the hood, exposes typed clients for VTEX platform APIs, and wires in tracing, metrics, caching, and error reporting.

This is a published npm library: `@vtex/api@7.3.1`. Tech stack: TypeScript `^4.4.4`, Node.js `>=8` advertised in `engines.node` (CI publish runs on Node `22`), Yarn (classic), `tsc` build, Jest `^25.1.0` with `ts-jest`, TSLint with `tslint-config-vtex`, Prettier.

## Tech Stack

- TypeScript `^4.4.4` (`strict: true`).
- Node.js `>=8` per `engines.node`; CI publish on Node `22`.
- Yarn (classic) — `yarn.lock` is the source of truth.
- Build: `tsc` against `tsconfig.json` → outputs to `lib/`.
- Tests: Jest `^25.1.0` + `ts-jest`.
- Lint: `tslint` + `tslint-config-vtex`.
- Format: Prettier (`.prettierrc`).
- Runtime deps include Koa 2, GraphQL 14, axios 1.8, jaeger-client, opentelemetry, prom-client. These are part of the contract — bumping their majors is a MAJOR release.

## Prerequisites

- Node.js `>=8` (for working with the codebase, prefer the version CI uses: `22`).
- Yarn (classic, v1).
- No other tools required for local development.

```bash
yarn
```

### Build & Run

```bash
# Clean build (outputs to lib/)
yarn build

# Watch / incremental build
yarn watch

# Regenerate JSON schema in gen/ (used by the public API)
yarn gen

# CI build (build + gen)
yarn ci:build
```

There is no "run" — this is a library. To exercise local changes inside a consumer app, use `yarn link`:

```bash
# In this repo:
yarn link
yarn watch

# In the consuming app's `node/` folder:
yarn link @vtex/api
```

Remember to `yarn unlink @vtex/api` when you're done.

### Test Commands

```bash
# All tests
yarn test

# CI tests with coverage
yarn ci:test

# Lint
yarn lint

# Prettier check (CI mode)
yarn ci:prettier-check

# Format the source tree
yarn format
```

Jest is configured in `jest.config.js` (root: `<rootDir>/src`, transform via `ts-jest`, mock for `@vtex/diagnostics-semconv` under `__mocks__/`).

### Public API

The library's published surface is:

| Field | Value |
|-------|-------|
| `name` | `@vtex/api` |
| `main` | `lib/index.js` |
| `typings` | `lib/index.d.ts` |
| `files` | `["lib/", "gen/"]` |

`src/index.ts` lists every public re-export explicitly. Anything reachable through these entry points is part of the public API and is owned. Anything else is internal and may change at will.

### Architecture Boundaries

| Folder | Responsibility |
|--------|----------------|
| `src/index.ts` | Single public entry. Explicit re-exports only; no wildcards from internal modules. |
| `src/HttpClient/` | HTTP client + middleware chain (axios-based). Used by every other client. |
| `src/clients/` | Typed clients for VTEX platform APIs. Depends on `HttpClient` and `caches`. |
| `src/caches/` | In-process and disk caches used by clients. |
| `src/service/` | VTEX IO runtime (Koa server, worker, master, lifecycle). Top of the dependency graph. |
| `src/metrics/`, `src/tracing/` | Telemetry primitives (OpenTelemetry, Prometheus, Jaeger). |
| `src/errors/`, `src/utils/`, `src/typings/` | Shared low-level building blocks. MUST NOT depend on `service/`, `clients/`, or `HttpClient/`. |
| `src/constants.ts` | Centralized env-var reads and platform constants. New `process.env.*` reads belong here. |
| `lib/` | Build output (`tsc`). NEVER committed; reproduced by `yarn build`. |
| `gen/` | Generated JSON schema (`yarn gen`). Part of the published artifact. |
| `docs/` | Long-form docs (metrics catalog, tracing). README is the entry point. |
| `__mocks__/` | Jest manual mocks. |

Rules:

- `src/index.ts` MUST re-export the public API explicitly. Wildcard exports from internal-only modules are forbidden.
- `src/service/` is the only place allowed to instantiate a Koa app or call `app.listen`.
- New `process.env.*` reads MUST live in `src/constants.ts`, `src/service/`, or another runtime-bootstrap module — never in `clients/`, `HttpClient/`, `caches/`, `utils/`, or `errors/`.
- Configuration for consumer-facing APIs comes through function arguments / options objects — not implicit globals.

### Coding Conventions

- TypeScript `strict: true`. Suppression annotations (`// @ts-ignore`, `// @ts-expect-error`, `// tslint:disable`) require a justifying comment.
- Type declarations (`*.d.ts`) cover every public export and are emitted by `tsc` into `lib/`.
- Tests are colocated with the modules they cover under `src/` (Jest picks up `*.(test|spec).ts(x)`).
- Tests MUST exercise behavior through the public API, not by reaching into internals.
- Format with Prettier before committing (`yarn format`); CI runs `yarn ci:prettier-check`.

### Build with `tsc`

- The build runs `tsc` against `tsconfig.json`. `declaration: true` is set; type declarations are part of the deliverable.
- `tsconfig.json` excludes `**/__tests__` and `**/*.test.ts`; do not import test-only helpers from production source paths.
- The `paths` mapping (`"axios": ["src/axios.d.ts"]`) exists to keep axios's public types stable across upgrades — only touch it in coordination with a dependency bump.

### Versioning & Release

- Semver is strict. Public type or signature changes are MAJOR; additive public surface is MINOR; bug fixes preserving the contract are PATCH.
- Tightening `engines.node` is MAJOR.
- Releases update `CHANGELOG.md` in user-facing terms before tagging.
- Publishing is CI-driven (`.github/workflows/publish-npm.yml`, CodeArtifact → npmjs). `scripts/publishLock.sh` refuses local `yarn publish` unless `IS_CI=true`; do not bypass it for non-emergency publishes.

### Safety Guardrails

- NEVER commit `node_modules/`, `lib/`, or any build artifact (already covered by `.gitignore`).
- NEVER commit `.npmrc` containing tokens, registry credentials, or any secret.
- NEVER add `process.env.*` reads outside `src/constants.ts` or `src/service/`.
- NEVER perform side effects on import in non-`service/` modules (network calls, file I/O, mutable singletons at module scope). The single accepted top-level mutation is `process.env.FORCE_COLOR = '1'` in `src/index.ts`.
- NEVER expose internal modules through wildcard re-exports from `src/index.ts`.
- NEVER drop a Node version from `engines.node` without a MAJOR version bump.
- NEVER bypass `scripts/publishLock.sh`; emergency hotfixes still publish through CI.
- NEVER edit `.github/workflows/publish-npm.yml` as part of a governance / agent-driven change; that workflow has security-sensitive permissions (`id-token: write`).
- NEVER instantiate a Koa app or call `app.listen` outside `src/service/`.
