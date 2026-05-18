# Scope of Work

The goal of this work is to split this project into two, where one is dedicated for the internal of the runtime of the node applications and the other is the public library that exposes our services to be used by those applications.

# Description

Today this repo mixes the internal runtime of the node applications with the public library that exposes our services to be used by those applications, causing confusion on maintanability and also exposing internal implementation details that can open doors for exploration.

## Goals

- Generate two separate packages: one for the internal runtime and one for the public library.
- Each package will have its own versioning and release cycle.
- Each package will have its own folder, lib will be inside node-vtex-lib and runtime in node-vtex-runtime outside of this repo.
- Each package should have its own testing approach and test methods
- Each package should have its own documentation


## Non-goals

- Break any existing functionality.
- Update any dependency version.
- Break any method contract.

## Non-Functional Requirements

> O11y golden path: https://github.com/vtex/diagnostics (docs/diagnostics-specification)

- **NFR-O11y-001 (Parity)**: Telemetry emitted by an unchanged consumer app
  MUST be byte-equivalent (field names, semconv attributes, sampling) before
  and after upgrading to `@vtex/api@8.0.0` against the new runtime. Verified
  by the contract suite (FR-014).
- **NFR-O11y-002 (OTel conformance)**: Host-registry hooks (FR-011) MUST
  accept/return OpenTelemetry-spec types and MUST preserve W3C Trace Context
  + Baggage propagation across the runtime↔lib boundary.
- **NFR-O11y-003 (Correlation fields are part of the contract)**: The
  structural shapes referenced in FR-013 MUST include `trace_id`, `span_id`,
  `account`, `workspace`, and `operationId` as required keys; these are
  enumerated in the contract suite.
- **NFR-O11y-004 (Observable failure)**: Runtime startup failures (FR-010)
  MUST emit a FATAL structured event with `exception.*` and `service.*`
  semconv attributes.
- **NFR-O11y-005 (Resource ownership)**: `service.name`, `service.version`,
  `service.instance.id` are owned by the lib (consumer-app side); the runtime
  contributes only `host.*`, `process.*`, `k8s.*` resources.
- **NFR-Perf-001 (No regression at the seam)**: The split MUST not regress
  per-request latency or CPU overhead beyond the diagnostics spec budgets
  (span creation <100μs, context propagation <10μs, <5% CPU overhead),
  measured against the pre-split baseline.
- **NFR-Security: N/A** — packaging-only change; no new authn/authz or secret handling. (FR-008 captures the supply-chain property.)
- **NFR-Resilience: N/A** — supervisor + rollout unchanged (Out of Scope §4); startup-resolution failure mode addressed by FR-010 / NFR-O11y-004.
- **NFR-Privacy: N/A** — no PII flow changes.
- **NFR-Accessibility: N/A** — no UI surface.
