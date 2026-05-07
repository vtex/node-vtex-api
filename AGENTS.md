# AGENTS.md — node-vtex-api

## Project Overview

`@vtex/api` is the official VTEX IO API client library for Node.js. It provides the runtime infrastructure for VTEX IO node services: typed API clients for all VTEX platform services (Apps, BillingMetrics, Events, License Manager, etc.), a Koa-based service framework with middleware composition, OpenTelemetry tracing integration, metrics collection via both a diagnostics-based system and a legacy accumulator, caching abstractions (in-memory, disk, stale-while-revalidate), and shared TypeScript types used across VTEX IO apps.

This is a published npm library: `@vtex/api@7.3.1`. Tech stack: TypeScript `^4.4.4`, Node.js `>=8`, yarn, tsc, Jest, tslint.

## Prerequisites

- Node.js `>=8` (per `engines.node`; CI uses Node 22 for publishing).
- Package manager: `yarn`.

```bash
yarn
```

### Build & Run

```bash
# Build (outputs to lib/)
yarn build

# Watch / incremental build
yarn watch

# Format then lint
yarn format-lint
```

There is no "run" — this is a library. Local consumers use `yarn link` / `yarn link @vtex/api` to point at the local checkout:

```bash
# In this repo
yarn link

# In the consuming app's node directory
yarn link @vtex/api
```

### Test Commands

```bash
# All tests
yarn test

# CI (with coverage)
yarn test --ci --coverage

# Lint
yarn lint

# Filter by test name (Jest --testNamePattern)
yarn test --testNamePattern="<pattern>"
```

### Public API

The library's published surface is:

| Field | Value |
|-------|-------|
| `name` | `@vtex/api` |
| `main` | `lib/index.js` |
| `typings` | `lib/index.d.ts` |
| `files` | `["lib/", "gen/"]` |
| `exports` | not declared (consumers use `main`) |

Anything reachable through `lib/index.js` and `lib/index.d.ts` is part of the public API and is owned. Anything else is internal and may change at will.

### Architecture Boundaries

| Folder | Responsibility |
|--------|----------------|
| `src/` | Library source; `src/index.ts` is the public API entry. |
| `src/clients/` | Typed VTEX platform API clients (built on `HttpClient`). |
| `src/HttpClient/` | Base HTTP client wrapping axios with retry, tracing, and caching. |
| `src/service/` | Koa-based service runtime: worker lifecycle, routing, GraphQL, event handling. |
| `src/caches/` | Cache layer implementations (in-memory, disk, stale-while-revalidate). |
| `src/metrics/` | Metrics collection: diagnostics-based (OTel) and legacy accumulator. |
| `src/tracing/` | OpenTelemetry tracing integration and Jaeger client. |
| `src/typings/` | Shared TypeScript type definitions. |
| `src/errors/` | Error class hierarchy. |
| `src/utils/` | Shared utilities. |
| `lib/` | Build output. NEVER committed; reproduced from source by `yarn build`. |
| `gen/` | Generated JSON schema (`manifest.schema`). Reproduced by `yarn gen`. |
| `__mocks__/` | Jest module mocks. |
| `docs/` | Long-form docs (metrics catalog, tracing guide). README is the entry point. |

Rules:

- `src/index.ts` is the sole public API gate. Internal modules MUST NOT be imported directly by consumers.
- Library code MUST NOT read `process.env` (except the documented `FORCE_COLOR` assignment in `src/index.ts`).
- Configuration comes through constructor arguments and options objects — not implicit globals.
- `lib/` and `gen/` (schema only) are published artifacts; NEVER commit `lib/` to the repository.

### Coding Conventions

- TypeScript `strict: true`; suppression annotations require a justifying comment.
- CommonJS module format (`module: "commonjs"`, target: `es2019`).
- Tree-shakeable at the module level: a consumer importing one symbol MUST NOT pull in unrelated subsystems (service runtime, metrics, tracing are separate exports).
- Type declarations (`*.d.ts`) cover every public export and are part of the published artifact.

**Build with `tsc`**

- The build runs `tsc` against `tsconfig.json`; no bundler.
- `declaration: true` is set — type declarations are emitted alongside JS.
- Avoid runtime-only compilation tricks (decorators-with-metadata, `tsc-alias` rewrites) unless documented.

### Versioning & Release

- Semver is strict. Public type or signature changes are MAJOR; additive public surface is MINOR; bug fixes preserving the contract are PATCH.
- Releases update `CHANGELOG.md` in user-facing terms before publishing.
- Publishing is CI-driven via the `publish-npm.yml` workflow (manual dispatch); local `npm publish` is reserved for emergency hotfixes and MUST be documented in the changelog.

### Safety Guardrails

- NEVER commit `node_modules/` or `lib/` (build output).
- NEVER commit `.npmrc` containing tokens, registry credentials, or any secret.
- NEVER read `process.env` from library code beyond the documented `FORCE_COLOR` side-effect; configuration comes through function arguments.
- NEVER perform side effects on import beyond what is documented (the `FORCE_COLOR` assignment is the only known top-level side effect).
- NEVER expose internal modules through the public entry (`src/index.ts`) unless they are intentionally public.
- NEVER drop a Node version from `engines.node` without a MAJOR version bump.
- NEVER skip the `prepublishOnly` pipeline when releasing; `scripts/publishLock.sh` enforces CI-only publishing.
- NEVER use `npm publish --force` to overwrite an existing version; deprecate and republish with a new version instead.
