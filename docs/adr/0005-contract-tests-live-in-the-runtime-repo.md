# 0005 — Contract tests live in the runtime repo, not the lib repo

## Status

Accepted

## Decision

The end-to-end test suite that exercises the runtime ↔ lib contract (Service
shape, host-registry hand-off, error duck-typing, log/metric flow) lives in
the `@vtex/api-runtime` package, not in `@vtex/api`. Lib's own test suite
covers its public API at the unit level; it does **not** include tests that
describe or assert runtime expectations.

When runtime CI runs, it pulls the latest published `@vtex/api`, boots a
fixture consumer app against the in-development runtime, and asserts the
contract holds.

## Why

`@vtex/api` is a public package. Anything in its repository — including test
fixtures, assertions, and helper utilities — is visible to every consumer.
Placing contract tests in lib would document, in publicly readable code,
which `register*` functions exist, what error shapes the runtime relies on,
how logs and metrics flow, and what the runtime expects of `Service.config`.
That is implementation detail of the runtime, not of the public library, and
publishing it widens the attack surface against the platform.

Putting contract tests in the runtime — which is internal and never published
to the public npm registry — keeps that information inside the platform
boundary.

## Considered alternatives

- **Contract tests in the lib repo.** Rejected for the leakage reason above.
  This would have been the natural choice on engineering grounds — lib *owns*
  the contract surface — but the confidentiality consideration overrides.
- **Contract tests in both repos.** Rejected for now: doubled CI cost without
  closing a different gap than the lib-repo location would already close.
  Reconsider if a near-miss demonstrates a need.
- **Contract tests in a third, dedicated repo.** Rejected: org-scale overhead
  not justified by two packages.

## Consequences

- Lib's CI is **green even when the contract is broken**. The break surfaces
  only when runtime CI next runs — which may be after lib has already
  published to all consumer apps. A release-pipeline coordination is required
  to close this timing gap: lib publishes first to the `next` dist-tag,
  runtime CI consumes `next` and runs the contract suite, and promotion to
  `latest` is gated on green. This is captured as an open thread in
  `CONTEXT.md` and is out of scope for this ADR.
- The runtime repo needs a test harness capable of installing a specific
  published version of `@vtex/api`, building a fixture consumer app against
  it, and booting the runtime end-to-end. This harness is non-trivial and
  should be the first artifact built in the split.
- Lib contributors do not have direct visibility into whether their change
  preserves the contract. They depend on runtime CI as the gate. Code review
  of any change touching the host registry, `Service` types, error classes,
  or the metrics/logger/tracer modules must explicitly check whether a
  contract change is in play and, if so, coordinate with runtime.
