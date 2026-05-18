# 0001 — Lib and runtime share no npm dependency; coupling is a structural contract

## Status

Accepted

## Decision

`@vtex/api` (lib) and `@vtex/api-runtime` (runtime) do not declare each other
in their `package.json` files — neither as a regular dependency, nor as a peer
dependency. At **compile time**, the runtime imports lib **types only** via a
`devDependency` (`import type { ... } from '@vtex/api'`). At **process startup**,
the runtime resolves the consumer app's installed `@vtex/api` copy via
`require.resolve('@vtex/api', { paths: [appPath] })` and value-loads it once to
obtain canonical references to shared singletons (logger, tracer, recorder,
metrics accumulator). After that, the contract between the two packages is
purely structural: `Service.config` shape, host-registry `register*` functions
on lib, and duck-typed request-time shapes (errors, metric entries, log
messages).

## Why

The split exists so the lib can evolve independently of the runtime — new
clients, new helpers, new public APIs — without forcing a runtime release, and
vice versa. Any npm-level dependency (regular or peer) would couple their
release schedules: a lib major bump would force a runtime release to update
its declared range, defeating the goal.

The runtime still needs *some* compile-time knowledge of lib's shapes to type-
check its own code that reads `Service.config`, and *some* runtime-time access
to lib's singleton implementations so it can log, trace, and emit metrics
through the same logger consumer apps use. Type-only `devDependency` imports
satisfy the first; dynamic resolution of the app's lib copy at startup
satisfies the second. Neither creates a published dependency.

## Considered alternatives

- **Lib as a peer dependency of runtime.** Rejected: forces a runtime release
  every time lib's declared range changes, and the resolution-time benefits
  (single copy in `node_modules`) don't apply anyway because runtime and
  consumer app live in different `node_modules` trees.
- **Lib as a regular dependency of runtime.** Rejected: same coupling problem,
  plus the runtime would ship its own pinned copy of lib that diverges from
  the consumer's copy.
- **A shared `@vtex/api-protocol` types-only package depended on by both.**
  Rejected: three packages, three release cadences, more friction than two.
  Reconsider if the contract grows complex enough to warrant a dedicated
  artifact.

## Consequences

- `instanceof` checks across the runtime ↔ consumer-app boundary are forbidden.
  Two physical copies of every shared class will exist (one in the runtime
  container's `node_modules`, one in the consumer app's bundle). All cross-
  boundary checks must be by shape (`err.name === 'UserInputError'`,
  `err.statusCode`, etc.).
- The runtime's correctness depends on `require.resolve('@vtex/api', { paths: [appPath] })`
  succeeding at startup. The runtime must fail loud and early at startup if
  resolution fails — never silently degrade.
- Changes to the `Service.config` shape, the host-registry surface, or the
  duck-typed request-time shapes are *contract changes*. They are not caught
  by either package's type checker (T3 only types what is imported) and must
  be coordinated explicitly. See ADR-0005 for how contract tests guard this.
