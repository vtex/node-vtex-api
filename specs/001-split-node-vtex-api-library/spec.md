# Feature Specification: Split `node-vtex-api` into Public Library and Internal Runtime

**Feature Branch**: `0001-split-node-vtex-api-library`

**Created**: 2026-05-15

**Status**: Draft

**Input**: User description: "Based on the @CONTEXT.md and the generated ADRs at /docs/adr/ to build the @SCOPE_OF_WORK.md"

---

## Overview

The `node-vtex-api` repository today ships a single npm package (`@vtex/api`) that mixes two distinct concerns: the **public API** that VTEX IO consumer apps program against (typed clients, error classes, the `Service` declaration, logger, metrics accumulator), and the **internal runtime** that the VTEX IO platform uses to host those apps (Koa server bootstrap, master/worker lifecycle, request middleware, telemetry export). This mixture causes three problems: maintainability is degraded because the boundary between public and internal is unclear; internal implementation details are reachable by consumer apps, widening the surface a malicious or careless integration can exploit; and any runtime bug fix today requires every consumer app on the platform to cut a new release before the fix reaches production.

This feature splits the codebase into **two independently versioned packages**, while preserving the existing public name `@vtex/api` so that no consumer app has to change a `package.json` entry or an import path. The new internal package, `@vtex/api-runtime`, ships only inside the `service-runtime-node` Docker image and is pinned by the platform — never appearing in a consumer app's bundle. The two packages exchange information through a small, explicit structural contract; they share no npm dependency and release on independent cadences.

For this work, both packages live in `packages/lib` and `packages/runtime` of this repository (kept as a monorepo so the engineering team can review the split end-to-end in one place). A future physical extraction of the runtime to a separate repository is deliberately out of scope.

The architectural decisions that constrain this work are captured in `CONTEXT.md` and `docs/adr/0001`–`0005`. This specification translates those decisions into user-facing outcomes and acceptance criteria.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Consumer apps continue to work after the lib release (Priority: P1)

A VTEX IO consumer app team owns a Node service that imports from `@vtex/api`. When the first post-split version of `@vtex/api` (8.0.0) is published, their app continues to build, deploy, and run with no changes to their `package.json` or their source code — provided they were using only the documented public API. The IDE auto-completion they see when typing `import { ... } from '@vtex/api'` now lists only intended public symbols; previously-leaked runtime internals (such as the server bootstrap entry point and Koa-related types) no longer appear.

**Why this priority**: This is the foundation. Every other outcome depends on the lib release shipping without breaking the hundreds of consumer apps already in production. If consumer apps need to change code to upgrade, the scope-of-work non-goal "Do not break any method contract" is violated.

**Independent Test**: Take a representative sample of in-org consumer apps (mix of GraphQL apps, event handlers, public route handlers, and apps using all major lib features — clients, custom errors, logger, metrics, recorder). Bump each app's `@vtex/api` dependency to the new major version without touching any other file. Confirm that `yarn build`, the local development workflow, and a staging deploy all succeed for every sampled app.

**Acceptance Scenarios**:

1. **Given** a consumer app whose source uses only documented `@vtex/api` exports, **When** the team bumps `@vtex/api` to the new major version, **Then** the app builds, type-checks, and passes its existing test suite with no source-code changes.
2. **Given** a consumer app that was incorrectly importing a runtime-internal symbol (one of the symbols documented in the release notes as removed from the public surface), **When** the team bumps `@vtex/api`, **Then** the build fails with a clear type error pointing at the now-unexported symbol, and the release notes list a supported alternative.
3. **Given** a consumer app that was already in production on the previous major version, **When** the platform rolls the new runtime image while the app still depends on the previous lib major, **Then** the app continues to run; mixed lib/runtime majors within their supported overlap are permitted.

---

### User Story 2 — Platform team rolls runtime fixes without consumer releases (Priority: P1)

A platform engineer discovers a bug in the runtime (a memory leak in request handling, a misconfigured tracing exporter, a Koa middleware ordering bug, an issue with the master/worker process supervisor). They fix the bug in `@vtex/api-runtime`, publish a new patch version, bump the dependency in `service-runtime-node`, and roll the resulting image to the production cluster. Every consumer app on the platform inherits the fix on its next pod rotation, without any consumer team needing to know the fix happened.

**Why this priority**: This is the operational payoff that justifies the split. Today, a runtime fix requires every consumer app team to update their `@vtex/api` dependency and cut a new release — a coordination cost that effectively prevents fast incident response. This story turns runtime fixes into a platform-side operation.

**Independent Test**: Stage a synthetic runtime change (e.g., add a no-op log line at request boundary). Publish a new `@vtex/api-runtime` patch, bump `service-runtime-node`, deploy to a staging cluster. Confirm that consumer apps already running on staging emit the new log line after the image roll, without any consumer-side deployment.

**Acceptance Scenarios**:

1. **Given** a fix in the runtime package, **When** the platform team publishes the patch and rolls a new `service-runtime-node` image, **Then** the fix is observable in production consumer apps' behaviour without any consumer team taking action.
2. **Given** a consumer app's bundle, **When** the bundle's contents are inspected, **Then** no Koa-server, master/worker, or runtime middleware code is present; only the public lib code is included.
3. **Given** an outage caused by a runtime regression, **When** the platform team rolls back `service-runtime-node` to the previous image tag, **Then** every consumer app returns to the prior runtime behaviour within the normal pod-rotation window — no consumer redeploy required.

---

### User Story 3 — Lib and runtime release independently (Priority: P2)

The lib team wants to add a new client for a recently shipped VTEX platform API. They make the change in `packages/lib`, run lib's tests, and publish a new lib minor version. No coordination with the runtime team is required, no runtime release is triggered, and `service-runtime-node` does not change. Symmetrically, the runtime team can refactor Koa middleware, swap a tracing exporter, or change master/worker behaviour without lib involvement.

**Why this priority**: This is the long-term maintainability goal. Independent cadences mean lib feature velocity is no longer gated on the platform team's release schedule, and runtime hardening is no longer gated on lib's feature work. P2 because the foundational P1 stories must ship first; once they have, this story falls out almost for free.

**Independent Test**: Stage a lib-only change (a new exported helper) and a runtime-only change (a middleware reordering) on separate branches. Confirm each can be released, deployed (lib via npm; runtime via image roll), and validated without touching the other package.

**Acceptance Scenarios**:

1. **Given** a lib-only change, **When** the change is merged and lib is released, **Then** runtime CI is not triggered and `service-runtime-node` does not need a new build.
2. **Given** a runtime-only change, **When** the change is merged and runtime is released, **Then** the published `@vtex/api` artifact is unchanged.
3. **Given** a lib release candidate that accidentally breaks the runtime↔lib contract, **When** the runtime's contract-test suite runs against the release candidate, **Then** the regression is detected before the lib release is promoted to the default install channel.

---

### Edge Cases

- **Consumer app pinned to a much older lib major while platform runs a much newer runtime.** The runtime obtains lib singletons (logger, tracer, recorder) from the consumer app's bundle at startup; if the app's lib predates a required registration hook, the runtime must detect the missing hook at startup and fail loud with an actionable error, not silently lose telemetry.
- **Consumer app's bundle does not contain `@vtex/api`.** The runtime must fail to start with a clear diagnostic ("expected `@vtex/api` in the application bundle"). It must not silently fall back to its own internal copy of lib types, because no such copy exists.
- **Consumer app catches a runtime-thrown error and expects a specific class identity (`instanceof`).** Across the runtime↔consumer-app boundary, two physical copies of every shared class may exist. `instanceof` checks may evaluate to `false` even for the "same" error type. This must be documented as a known incompatibility, with migration guidance to shape-based checks.
- **A consumer app reaches into a symbol that was previously exported but is no longer part of the public surface.** Their build fails. The release notes must list the removed symbols and the supported replacements.
- **Mixed-version cluster during a runtime image roll.** During the rollout window, some pods run the new runtime and some run the old one. Both must remain compatible with the same in-production consumer app bundles; no consumer app version is exclusively compatible with one runtime minor and not the other.
- **Local development workflow.** A consumer-app developer running the app locally (e.g., via `vtex link`) is no longer using the production `service-runtime-node` image. The local development host must continue to work and use the same runtime semantics as production.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Package structure and naming

- **FR-001**: The repository MUST produce two independently versioned, independently published npm packages from a single monorepo structure: a public-facing package and an internal runtime package.
- **FR-002**: The public-facing package MUST be published under the existing name `@vtex/api`. Its first post-split version MUST be `8.0.0`, signalling the removal of previously-leaked internal symbols as a major version bump.
- **FR-003**: The internal package MUST be published under a new name (`@vtex/api-runtime`). Its first version MUST be `1.0.0`. It MUST NOT be published to any public registry channel that surfaces it as a recommended dependency for consumer apps.
- **FR-004**: Neither package's `package.json` MUST declare the other as a runtime dependency or peer dependency. Compile-time type access in the runtime MUST go through a `devDependency` (type-only import) on the lib.

#### Public API surface

- **FR-005**: Every symbol that consumer apps need to author a working IO Node service (the service declaration entry point, the typed-clients base class, the HTTP client, error classes, the logger, the metrics accumulator, the recorder, the GraphQL helpers, the tracing API) MUST be reachable from the lib package's main entry point and MUST be type-declared in the published artifact.
- **FR-006**: Symbols whose role is exclusively runtime bootstrap (Koa server creation, master/worker process supervision, request-pipeline middleware, internal lifecycle hooks) MUST NOT be reachable from the lib package's main entry point.
- **FR-007**: The lib release notes MUST enumerate every symbol previously exported by `@vtex/api@7.x` that is no longer part of the public surface, together with a supported alternative for each.

#### Runtime delivery

- **FR-008**: The runtime package MUST be installed only inside the `service-runtime-node` Docker image. It MUST NOT appear in a consumer app's `node/package.json`, `yarn.lock`, or shipped bundle.
- **FR-009**: At process startup inside a consumer app's container, the runtime MUST locate and load the canonical implementations of shared singletons (logger, tracer, recorder, metrics accumulator) from the consumer app's installed lib copy — not from any runtime-bundled lib copy.
- **FR-010**: If startup resolution of the consumer app's lib copy fails (lib not installed in the app, version below the minimum supported by the runtime, required registration hook missing), the runtime MUST fail to start with a clear, actionable diagnostic identifying which expectation was unmet.

#### Runtime ↔ Lib contract

- **FR-011**: The lib package MUST expose a small, explicit "host registry" surface (a set of named `register*` / `init*` functions) through which the runtime injects platform-level configuration (credentials, endpoints, transports, exporters) into lib's singletons at startup.
- **FR-012**: Lib's shared singletons MUST behave with safe defaults when no runtime has performed registration (so that unit tests and local-development scenarios that do not boot a runtime continue to work).
- **FR-013**: The runtime MUST consume objects flowing across the runtime↔consumer boundary (errors, log messages, metric entries, `Service` configuration) structurally — by reading documented fields — and MUST NOT rely on JavaScript class-identity checks (`instanceof`) for any cross-boundary object.

#### Testing and contract guarantee

- **FR-014**: An end-to-end contract test suite that exercises every contract point (service config shape, every host-registry hook, error duck-typing, log/metric/trace flow) MUST exist in the runtime package's test tree. The lib package's test tree MUST NOT contain test code that documents runtime expectations.
- **FR-015**: The runtime contract suite MUST be runnable against any specific published version of the lib package, so that a lib release candidate can be validated against the runtime before promotion.
- **FR-016**: The release workflow MUST include a step where a lib release candidate is published to a non-default install channel, validated against the runtime's contract suite, and promoted to the default install channel only on a green result.

#### Independent release cadence

- **FR-017**: A lib-only change MUST be releasable without triggering a runtime release, a `service-runtime-node` image build, or any consumer-app redeploy.
- **FR-018**: A runtime-only change MUST be releasable (by publishing a new runtime version and rolling `service-runtime-node`) without triggering a lib release or any consumer-app redeploy.
- **FR-019**: The repository's continuous-integration pipeline MUST run lib's and runtime's test suites independently, and a failure in one MUST NOT prevent the other from publishing.

#### Documentation

- **FR-020**: Each package MUST ship its own documentation set: the lib package documents its public API for consumer-app authors; the runtime package documents its internal architecture, contract obligations, and operational procedures for platform engineers.
- **FR-021**: The architectural decisions that constrain this work MUST remain captured in the repository (in `CONTEXT.md` and the `docs/adr/` directory) and MUST be referenced from each package's own documentation.

---

### Key Entities

- **Lib package (`@vtex/api`)**: The public, consumer-facing artifact. Owns every symbol consumer apps import by name, including the service declaration, typed clients, error classes, logger, metrics accumulator, recorder, and tracer API. Owns the canonical implementations of all shared singletons. Lives in `packages/lib/`.

- **Runtime package (`@vtex/api-runtime`)**: The internal, platform-only artifact. Owns the Koa server bootstrap, master/worker process supervisor, request-pipeline middleware, and telemetry transport setup. Has no public consumer surface. Lives in `packages/runtime/`.

- **Consumer app**: A VTEX IO Node service authored by a VTEX merchant or internal team. Depends on the lib package. Loaded and hosted at runtime by the runtime package, inside the `service-runtime-node` container.

- **`service-runtime-node` container**: The Docker image the VTEX IO platform deploys to host consumer apps. Pins a specific runtime-package version. The platform team's mechanism for rolling runtime changes across the fleet.

- **Runtime ↔ Lib contract**: The structural agreement between the two packages — `Service.config` shape, the host-registry surface, and the duck-typed shapes of cross-boundary objects (errors, log entries, metric entries). Not enforced by any npm dependency; enforced by the runtime's contract test suite.

- **Host registry**: The named set of `register*` / `init*` functions exported by the lib package. The runtime's hand-off mechanism for configuring lib's singletons at startup. Explicit and reviewable in lib's public API surface.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the lib release ships, **100% of in-org consumer apps that depended on `@vtex/api@7.x` build, deploy, and pass their existing test suites against the new lib major without any source-code change**, provided they were using only documented public API. (Measured by running the upgrade against a representative sample of at least 20 consumer apps before general release, and tracking post-release upgrade success across the org.)

- **SC-002**: A runtime patch fix can be **delivered to every consumer app in production within the normal `service-runtime-node` image roll window** (target: under 4 hours from runtime patch publish to fleet-wide rollout), without any consumer-app team taking action. (Measured by tracking elapsed time from runtime release tag to fleet pod-rotation completion.)

- **SC-003**: A consumer app's shipped bundle contains **zero bytes of Koa server, master/worker, or runtime-pipeline middleware code**. (Measured by inspecting the build output of a representative consumer app before and after the upgrade; size and content of runtime-internal modules drop to zero.)

- **SC-004**: At least **80% of lib releases over the first six months after the split are runtime-coordination-free** — i.e., a lib release proceeds end-to-end (publish, validate, promote) without any change to the runtime package or `service-runtime-node` image. (Measured by tagging each lib release with whether runtime coordination occurred and reporting monthly.)

- **SC-005**: Symmetrically, at least **80% of runtime releases over the first six months are lib-coordination-free**. (Same measurement approach.)

- **SC-006**: **Zero production incidents caused by silent contract drift** between lib and runtime in the first six months after the split. (Measured by post-incident review tagging; the contract-test gate at lib promotion is the primary control.)

- **SC-007**: The set of symbols reachable from the lib package's main entry point matches the documented public API surface with **100% precision** — no runtime-internal symbol is reachable; no documented public symbol is missing. (Measured by an automated check comparing the package's exported type declarations against a canonical public-API manifest.)

- **SC-008**: When a runtime regression is rolled back, **100% of affected consumer apps return to the prior runtime behaviour within one normal pod-rotation window** (target: under 30 minutes), with no consumer-team involvement. (Measured by drilling rollback on a staging cluster.)

---

## Assumptions

- **`service-runtime-node` image roll is the platform's normal upgrade mechanism for runtime changes.** The platform team owns the image and its release cadence. This feature does not change how the image is deployed, only what it contains.
- **Consumer apps' `node/package.json` dependency choices are owned by their teams.** The lib package can publish a new version, but it cannot force any consumer app to upgrade. The lib release notes and upgrade guide are the mechanism by which the org-wide upgrade happens.
- **The existing engineering team will review the split end-to-end in this repository before any future physical extraction of the runtime to a separate repo.** The monorepo phase is therefore explicitly the deliverable of this work; a follow-up "node-vtex-runtime" repo is out of scope.
- **Local-development workflows (`vtex link`, watch mode, in-process test harnesses) will continue to work with the new structure**, including for apps that previously relied on a single `@vtex/api` install. Any changes to local workflows are absorbed inside the runtime package and inside the platform's local development tooling.
- **The set of consumer apps that were incorrectly reaching into runtime internals is small and easily enumerable.** AGENTS.md already documents these as unsupported; the lib release notes will list the affected symbols and migration paths.
- **The CI infrastructure can support the proposed release-pipeline coordination** (publish lib to a non-default channel, run runtime contract tests against it, promote on green). This is a one-time setup cost paid during the foundation work.
- **The structural-contract design documented in ADR-0001 through ADR-0005 is the authoritative architectural baseline for this work.** This spec defines outcomes; the ADRs and CONTEXT.md define the architectural constraints under which those outcomes are pursued.

---

## Out of Scope

The following are explicitly **not** part of this work, even though they are related and may follow up:

- **Physical extraction of the runtime to a separate `node-vtex-runtime` repository.** Deferred indefinitely; the monorepo is the end state of this work.
- **Renaming the lib package.** The npm name `@vtex/api` is preserved.
- **Migrating consumer apps off any symbols that remain in the public surface.** Only symbols that were never part of the supported public surface are removed.
- **Changes to the existing runtime behaviour (Koa version, middleware ordering, telemetry exporters, master/worker logic).** The split is mechanical; it must preserve all observable runtime behaviour bit-for-bit unless a regression is detected during contract validation.
- **Upgrading any third-party dependency version** (Koa, GraphQL, axios, Jaeger client, OpenTelemetry, prom-client). The scope-of-work non-goal forbids it.
- **Changes to the public method signatures of any currently-exported lib symbol.** The scope-of-work non-goal forbids it.
- **A long-term deprecation shim package (e.g., `@vtex/api-legacy`)** for consumers stuck on the previous behaviour. No such shim is shipped.
