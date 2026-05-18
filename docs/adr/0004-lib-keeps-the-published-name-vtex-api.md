# 0004 — Lib keeps the published name `@vtex/api`; only the runtime gets a new name

## Status

Accepted

## Decision

The public, consumer-facing package continues to be published as **`@vtex/api`**.
The first post-split release is **`@vtex/api@8.0.0`** — major bump because
symbols that previously leaked from `src/service/` through `src/index.ts` (and
were never part of the supported public surface) are removed.

The new internal package is published as **`@vtex/api-runtime@1.0.0`**.

Consumer apps' `node/package.json` files and `from '@vtex/api'` import paths
do not change.

## Why

The scope-of-work non-goal "Do not break any method contract" rules out a
forced consumer migration. Renaming the package — even to a "better" name like
`@vtex/api-lib` — *is* a contract break: every consumer app's `package.json`
and every import statement would have to change. Hundreds of apps; coordinated
codemod; non-trivial regression risk for zero functional gain.

Conceptually, `@vtex/api` was *always* the consumer-facing package. The
runtime internals leaking through `src/index.ts` were an implementation
accident, not a feature. The split is internal hygiene; the public name should
reflect what it has always been.

## Considered alternatives

- **Both packages get new names** (`@vtex/api-lib` + `@vtex/api-runtime`),
  deprecate `@vtex/api`. Rejected: forced migration of every consumer app,
  conflicts with the scope's non-goal.
- **New names + a thin `@vtex/api` re-export shim** for back-compat. Rejected:
  a third package whose deprecation date is "never," because no consumer
  bothers to migrate away from a working name. Permanent extra surface area.

## Consequences

- The `@vtex/api@8.0.0` release notes must enumerate the symbols removed from
  the public surface (the previously-leaked runtime internals). Consumers who
  were incorrectly reaching into those symbols (against AGENTS.md's existing
  guidance) will need to migrate to a supported alternative or accept the
  break.
- The repo currently named `node-vtex-api` becomes the home of `packages/lib/`
  (and, transitionally, `packages/runtime/` — see ADR or follow-up on the
  monorepo execution plan). The npm name and the repo name diverge; this is
  fine and common.
- Internal references in the codebase, docs, and CI that name `@vtex/api`
  meaning "the whole thing" need to be updated to name it specifically as
  "the lib package."
