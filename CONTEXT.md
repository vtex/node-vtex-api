# node-vtex-api

This repository today ships a single npm package, `@vtex/api`, that bundles two
distinct things: the **public API** that VTEX IO consumer apps program against,
and the **internal runtime** that the VTEX IO platform uses to host those apps.
The in-flight work splits these into two packages with separate release cycles.

## Language

**Consumer app**:
A VTEX IO Node service authored by a VTEX merchant or internal team — typically
a `node/` folder containing an `index.ts` that does `export default new Service({...})`.
_Avoid_: client app, user app, downstream app.

**Lib package**:
The public, consumer-facing package. Published as **`@vtex/api`** — the
existing npm name is preserved so no consumer's `package.json` or import
paths change. Owns every symbol a consumer app imports (`Service`,
`IOClients`, `HttpClient`, error classes, logger, metrics accumulator,
GraphQL helpers, recorder, tracer API). Lives in `packages/lib/` of this
repo (kept as a monorepo for the foreseeable future, so the engineering team
can review the split end-to-end in one place; a future physical-repo extraction
to `node-vtex-lib` is deferred and not in scope for this work). First post-split version: **`@vtex/api@8.0.0`** — major
bump because runtime-internal re-exports that previously leaked through
`src/index.ts` are removed.
_Avoid_: SDK, public API, types package.

**Runtime package**:
The internal, non-public package that boots the Koa server, owns master/worker
lifecycle, middleware chain, and the platform's host process. Published as
**`@vtex/api-runtime`** (new name). Pinned by the `service-runtime-node`
Docker image; never appears in a consumer app's `node/package.json`. Versioned
and released on its own cadence; the platform team upgrades it by bumping
`service-runtime-node` and rolling the image — no consumer release required.
Lives in `packages/runtime/` of this repo (same monorepo as the Lib package).
First version: **`@vtex/api-runtime@1.0.0`**.
_Avoid_: server, host, framework.

**Runtime ↔ Lib contract**:
The **only** thing that couples the two packages. It has three parts:

1. **`Service.config` shape** — the runtime reads `routes`, `graphql`,
   `events`, `clients` off the consumer's exported `Service` instance.
2. **Shared singletons owned by lib** — `logger`, `tracer`, `recorder`,
   `MetricsAccumulator`, and similar process-scoped utilities have their
   single canonical implementation in the **Lib package**. The **Runtime
   package** obtains live references to them at process startup by resolving
   the consumer app's installed `@vtex/api-lib` copy
   (`require.resolve('@vtex/api-lib', { paths: [appPath] })`) and value-loading
   it once. The runtime then calls lib-exported `register*` / `init*` functions
   to inject platform-level configuration (credentials, endpoints, transports)
   into those singletons, and uses them directly for its own logging, tracing,
   and metrics needs.
3. **Duck-typed request-time shapes** — errors (`name`, `statusCode`, `code`,
   `message`), log messages, metric entries flowing between the runtime and
   consumer handlers. Read by shape on the receiving side; `instanceof` is
   forbidden across the boundary because two physical copies of every class
   may exist if a consumer ever loads lib from an unexpected resolution path.

There is **no `package.json` dependency** between the packages. The runtime's
compile-time view of lib is a type-only `devDependency` import (`import type`).
The runtime's value-level view of lib is a one-time dynamic resolution at
startup, scoped to fetching the canonical singleton implementations. Changes
to any of the three parts above are contract changes and require coordinated
releases.

**Service** _(domain concept, also a class)_:
The typed configuration object a consumer app exports as its default export.
It is a config holder — the **Runtime package** `require()`s the consumer's
compiled code, retrieves the `Service` instance, and reads `service.config`
to wire routes, GraphQL resolvers, event handlers, and clients.
_Avoid_: app, handler registry.

**Public API surface**:
Everything reachable through the **Lib package**'s entry point. Anything not
reachable there is internal and may change without a major bump.

**Host registry**:
The set of `register*` / `init*` functions exported by the **Lib package** that
the **Runtime package** calls at startup to configure lib's singletons (logger
transport / log endpoint / credentials, tracer exporter, recorder state, etc.).
Lib owns the implementations; the runtime owns the configuration. Replaces the
legacy pattern of module-level `let` variables initialised by the runtime.

## Relationships

- A **Consumer app** depends on the **Lib package** at compile time and runtime.
- The **Runtime package** declares **no** dependency — npm or peer — on the
  **Lib package**. It speaks to the consumer app's lib copy only through the
  **Runtime ↔ Lib contract** (structural).
- `service-runtime-node` pins a specific **Runtime package** version. Consumer
  apps independently pin their own **Lib package** version. The two are
  upgraded on independent schedules.
- At process start, the **Runtime package** loads a **Consumer app**'s compiled
  bundle, retrieves its **Service** instance, and reads `service.config` to
  host it. The runtime treats incoming objects structurally; `instanceof`
  across the runtime↔app boundary is forbidden because two physical copies
  of every shared class exist.
- Neither package depends on the other for build; their release cycles are
  independent.

## Example dialogue

> **Dev:** "If a consumer throws `UserInputError`, who catches it?"
> **Domain expert:** "The **Runtime package**'s GraphQL middleware does. There
> are two physical copies of `UserInputError` — one in the runtime's bundle,
> one in the app's — so the middleware matches on `err.name === 'UserInputError'`
> and reads `err.statusCode`, never `instanceof`. That's the Runtime ↔ Lib
> contract: shape, not identity."
> **Dev:** "What if lib adds a new field to `UserInputError`?"
> **Domain expert:** "Fine — runtime ignores fields it doesn't know about. The
> contract is additive on the lib side and read-only on the runtime side."

## Open threads

- **Release-pipeline coordination under CT2.** Contract tests live in the
  runtime repo, but lib ships independently to all consumer apps. A lib
  release with a silent contract regression reaches production before runtime
  CI catches it. Proposed mitigation (to be confirmed): lib publishes to the
  `next` dist-tag first; runtime CI consumes `next` and runs the contract
  suite; promotion to `latest` is gated on green. Out of scope for the
  architecture decision; in scope for the release-pipeline work.

## Flagged ambiguities

- "Runtime" was initially used in the scope of work to mean *everything under
  `src/service/`*. Resolved: the **Runtime package** is narrower than that —
  the `Service` class, `logger`, GraphQL schema helpers, `method`, and
  `recorder` currently live under `src/service/` but are **public API** and
  therefore move to the **Lib package**.
- An earlier draft proposed making the lib a **peer dependency** of the
  runtime. Rejected: that would force a runtime release every time the lib
  changed its declared peer range, defeating the independent-cadence goal.
