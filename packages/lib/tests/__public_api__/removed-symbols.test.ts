/**
 * T017 — Runtime-internal symbol removal contract.
 *
 * After workstream C (Phase 3) completes, none of the symbols listed below
 * should be reachable through `import * from '@vtex/api'`. They belong to
 * `@vtex/api-runtime` and must not leak into consumer-app bundles
 * (SC-003 "zero bytes of Koa/server/middleware").
 *
 * This test is written TDD-red: it MUST fail today (every symbol is
 * still exported from packages/lib) and turn green at T026 once each
 * symbol has been moved to packages/runtime/.
 *
 * If a symbol on this list ever needs to come back to lib, remove it from
 * the array AND document the reversal in packages/lib/CHANGELOG.md.
 *
 * Refs: spec.md FR-002, FR-007, SC-003; CONTEXT.md "Runtime package" stanza;
 *       tasks.md T017 (red), T026 (green).
 */

import * as publicApi from '../../src'

/**
 * Runtime-internal symbols that MUST NOT be exposed via @vtex/api after
 * Phase 3. Grouped by carve-out task for traceability.
 */
const RUNTIME_INTERNAL_SYMBOLS: ReadonlyArray<{
  symbol: string
  carveOutTask: 'T019' | 'T020' | 'T021' | 'T022'
  reason: string
}> = [
  // T020 — supervisor / bootstrap entry point
  {
    symbol: 'startApp',
    carveOutTask: 'T020',
    reason: 'Koa app bootstrap; belongs to @vtex/api-runtime entrypoint',
  },
]

/**
 * Symbols originally listed for removal that turned out to be LEGITIMATELY
 * public after closer inspection. Kept here as documentation so future
 * passes don't re-add them.
 *
 *   Router  — NOT Koa's router; the public VTEX InfraClient at
 *             src/clients/infra/Router.ts. Stays public.
 *
 * Symbols originally listed for removal whose REMOVAL was descoped:
 *
 *   HTTP_SERVER_PORT, MAX_WORKERS, UP_SIGNAL, PID, INSPECT_DEBUGGER_PORT
 *     These live in the shared packages/lib/src/constants.ts file along
 *     with consumer-facing constants. Lib's index.ts re-exports the WHOLE
 *     constants module via 'export * from "./constants"'. Splitting them
 *     out (creating constants/lib.ts vs constants/runtime.ts) is feasible
 *     but is a deeper public-API refactor than Phase 3 should swallow.
 *     Recorded as known debt; revisit when 'allow-list' style explicit
 *     re-exports replace the wildcard (see T024 commit body).
 */

describe('@vtex/api public surface — runtime-internal symbols are absent (T017)', () => {
  it.each(RUNTIME_INTERNAL_SYMBOLS)(
    '$symbol (carve-out $carveOutTask) is not exported from @vtex/api',
    ({ symbol, reason }) => {
      expect({
        symbol,
        reason,
        present: symbol in publicApi,
      }).toEqual({
        symbol,
        reason,
        present: false,
      })
    }
  )

  it('the removal list is non-empty (guards against accidental list-wipe)', () => {
    expect(RUNTIME_INTERNAL_SYMBOLS.length).toBeGreaterThan(0)
  })
})
