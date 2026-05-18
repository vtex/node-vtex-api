# 0003 — Shared singletons use a host-registry DI pattern, not module-level state or `global`

## Status

Accepted (experimental)

## Decision

Process-scoped utilities shared across the runtime ↔ lib boundary — logger,
tracer, recorder, and similar — have their canonical implementations in lib.
Lib exports a small set of `register*` / `init*` functions ("the host
registry") through which the runtime injects platform-level configuration
(transports, credentials, endpoints, exporters) at process startup. Lib code
calls `getLogClient()`, `getTracer()`, etc. and receives the configured
implementation. Lib provides safe fallbacks when no runtime has registered
(so unit tests don't need to boot one). The runtime, after configuring lib's
singletons, uses lib's exported logger/tracer/recorder directly for its own
needs.

The legacy pattern of module-level `let client: ... | undefined` variables
initialised by the runtime is replaced by this registry. The existing
`global.metrics = new MetricsAccumulator()` pattern is migrated to the registry
shape for consistency.

## Why

In the single-package world, the runtime could initialise lib's module-level
state directly because both halves shared the same `require` cache entry. Once
the packages are split, two physical copies of every shared module may exist,
each with its own module-level state — so the runtime's initialisation of one
copy is invisible to the other. We need an explicit hand-off mechanism.

Two patterns were available: (a) park state on `global` so both copies of lib
converge on a single slot, or (b) make the hand-off a typed function call.
(b) — the registry pattern — was chosen because it makes the runtime ↔ lib
contract visible in lib's public API (every `register*` function *is* a
contract point), as opposed to scattered `global.__vtex*` reads across the
codebase that are easy to miss in review.

Marked **experimental** because the team has not used this pattern before and
the migration cost across logger, tracer, recorder, and metrics is non-trivial.
If the pattern proves friction-heavy in practice, falling back to the `global`
approach is straightforward and isolated to the affected modules.

## Considered alternatives

- **Move all shared mutable state to `global.__vtex_*`** (the pattern
  `MetricsAccumulator` already uses). Rejected as primary because the coupling
  becomes wallpaper-level — scattered untyped reads throughout the codebase
  rather than a small set of named entry points reviewable as a contract.
- **Per-module decision (`global` for legacy, registry for new).** Rejected:
  produces an inconsistent codebase where every shared module needs to be read
  to know how it's wired.

## Consequences

- Lib's public API grows by a handful of `register*` / `get*` functions. These
  *are* the host registry contract — changes to them are contract changes
  (ADR-0001).
- Every module currently using module-level `let` to hold runtime-injected
  state (logger, recorder, tracer init, any LRU caches initialised by the
  runtime) is refactored to read through the registry. Public method
  signatures for consumers are preserved.
- Unit tests that previously relied on the runtime having initialised some
  module-level state now exercise the fallback path or call `register*`
  explicitly. Test ergonomics need a small helper in lib (e.g.
  `__resetHostRegistry()` for tests).
- The registry's storage mechanism (in-memory closure inside lib's compiled
  output) means each physical copy of lib has its own registry. The runtime
  populates whichever copy belongs to the consumer app's bundle (per
  ADR-0001's Reg-A resolution).
