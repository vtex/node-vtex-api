# 0002 — Runtime is delivered only via `service-runtime-node`, never via the consumer app's `node_modules`

## Status

Accepted

## Decision

`@vtex/api-runtime` is pinned as a dependency of the `service-runtime-node`
Docker image and ships only inside that image's filesystem. It never appears
in a consumer app's `node/package.json`, `yarn.lock`, or runtime bundle.
Consumer apps depend solely on `@vtex/api` (lib).

## Why

The scope-of-work goal is to stop "exposing internal implementation details
that can open doors for exploration." If the runtime lives in the consumer's
`node_modules`, it is — for all practical purposes — public: discoverable in
lockfiles, require-able by any code in the bundle, and pinned per consumer
app. None of those properties match "internal."

Containerising the runtime delivery also unlocks the main operational payoff
of the split: the platform team can hotfix the runtime (Koa version, lifecycle
bug, tracing exporter, master/worker behaviour) by bumping
`service-runtime-node` and rolling the image. No consumer app needs to cut a
release, bump a dependency, or redeploy on its own. Today's model — where
`@vtex/api`'s runtime half lives in every app's `node_modules` — makes this
impossible without coordinating hundreds of consumer releases.

## Considered alternatives

- **Runtime as a regular dependency of the consumer app**, identical to
  today's `@vtex/api` shape. Rejected: re-creates the per-app version coupling
  the split is meant to eliminate.
- **Runtime as a sidecar process** alongside the consumer's Node process.
  Rejected: more invasive than the scope of work permits; the existing
  `service-runtime-node` container already provides sufficient isolation.

## Consequences

- `service-runtime-node`'s `package.json` swaps its `@vtex/api: 7.3.1`
  dependency for `@vtex/api-runtime: 1.x`. The container's bootstrap shim
  (`src/index.ts`) loads `startApp` from its **own** copy of
  `@vtex/api-runtime`, not from the consumer app's bundle.
- The existing `smartRequire` helper survives in modified form: it is used
  only to resolve **lib** (`@vtex/api`) from the consumer app's bundle, never
  to resolve the runtime. See ADR-0001 for the resolution mechanics.
- Runtime upgrades become a platform-side operation. A regression in a
  runtime release impacts every consumer app on the next image roll — which
  raises the bar for runtime release confidence and motivates the contract
  test suite (ADR-0005).
