/**
 * T018 — Public surface preservation contract.
 *
 * Every symbol in PRESERVED_SYMBOLS below is documented in CONTEXT.md's
 * "Lib package" stanza or in CHANGELOG history as part of @vtex/api's
 * supported public API. They MUST remain exported from packages/lib
 * across the Phase 3 carve-out (workstream C) and beyond.
 *
 * This test is the COMPLEMENT to removed-symbols.test.ts (T017):
 *   - T017 guards what must DISAPPEAR.
 *   - T018 guards what must REMAIN.
 *
 * Both tests together pin down the public surface from two directions.
 *
 * Each symbol carries a metadata triple `(symbol, kind, owner)` so a
 * regression message tells you exactly what broke and which lib-internal
 * area owns it.
 *
 * Refs: spec.md FR-001, FR-002, SC-007; CONTEXT.md "Lib package" stanza;
 *       tasks.md T018 (today: green) and T025 (post-carve-out: still green).
 */

import * as publicApi from '../../src'

type SymbolKind = 'class' | 'function' | 'const' | 'type-or-value'

const PRESERVED_SYMBOLS: ReadonlyArray<{
  symbol: string
  kind: SymbolKind
  owner: string
}> = [
  // Core service abstraction (post-carve-out: pure config holder)
  { symbol: 'Service', kind: 'class', owner: 'service/worker/runtime/Service' },
  { symbol: 'method', kind: 'function', owner: 'service/worker/runtime/method' },

  // IO client base classes + concrete clients
  { symbol: 'IOClient', kind: 'class', owner: 'clients/IOClient' },
  { symbol: 'IOClients', kind: 'class', owner: 'clients/IOClients' },
  { symbol: 'AppClient', kind: 'class', owner: 'clients/AppClient' },
  { symbol: 'AppGraphQLClient', kind: 'class', owner: 'clients/AppGraphQLClient' },
  { symbol: 'ExternalClient', kind: 'class', owner: 'clients/ExternalClient' },
  { symbol: 'InfraClient', kind: 'class', owner: 'clients/InfraClient' },
  { symbol: 'JanusClient', kind: 'class', owner: 'clients/JanusClient' },
  { symbol: 'GraphQLClient', kind: 'class', owner: 'clients/GraphQLClient' },
  { symbol: 'IOGraphQLClient', kind: 'class', owner: 'clients/IOGraphQLClient' },

  // HTTP layer
  { symbol: 'HttpClient', kind: 'class', owner: 'HttpClient' },

  // Error taxonomy (every named error class is documented public API)
  { symbol: 'AuthenticationError', kind: 'class', owner: 'errors' },
  { symbol: 'ForbiddenError', kind: 'class', owner: 'errors' },
  { symbol: 'NotFoundError', kind: 'class', owner: 'errors' },
  { symbol: 'TooManyRequestsError', kind: 'class', owner: 'errors' },
  { symbol: 'UserInputError', kind: 'class', owner: 'errors' },
  { symbol: 'ResolverError', kind: 'class', owner: 'errors' },
  { symbol: 'ResolverWarning', kind: 'class', owner: 'errors' },
  { symbol: 'RequestCancelledError', kind: 'class', owner: 'errors' },

  // Metrics & logging singletons that consumer apps reach for
  { symbol: 'Logger', kind: 'class', owner: 'service/logger' },
  { symbol: 'LogLevel', kind: 'type-or-value', owner: 'service/logger' },
  { symbol: 'logOnceToDevConsole', kind: 'function', owner: 'service/logger' },
  { symbol: 'MetricsAccumulator', kind: 'class', owner: 'metrics/MetricsAccumulator' },
  { symbol: 'DiagnosticsMetrics', kind: 'class', owner: 'metrics/DiagnosticsMetrics' },

  // Recorder helpers (VBase write batching) — public per CONTEXT
  // (re-exported from service/worker/runtime/utils/recorder)
  // Specific symbol names depend on recorder/index.ts; checked at runtime.

  // GraphQL helpers (CONTEXT "GraphQL helpers" stanza)
  {
    symbol: 'nativeSchemaDirectives',
    kind: 'const',
    owner: 'service/worker/runtime/graphql/schema/schemaDirectives',
  },
  {
    symbol: 'nativeSchemaDirectivesTypeDefs',
    kind: 'const',
    owner: 'service/worker/runtime/graphql/schema/schemaDirectives',
  },
  {
    symbol: 'createMessagesLoader',
    kind: 'function',
    owner: 'service/worker/runtime/graphql/schema/messagesLoaderV2',
  },

  // Tracing API surface (CONTEXT "Tracing API" stanza)
  { symbol: 'ErrorReport', kind: 'class', owner: 'tracing/errorReporting' },
  { symbol: 'Span', kind: 'type-or-value', owner: 'tracing' },
  { symbol: 'SpanReferenceTypes', kind: 'const', owner: 'tracing/spanReference' },
  { symbol: 'TracingTags', kind: 'const', owner: 'tracing/Tags' },
  { symbol: 'createSpanReference', kind: 'function', owner: 'tracing/spanReference' },
  {
    symbol: 'createTracingContextFromCarrier',
    kind: 'function',
    owner: 'tracing',
  },
  { symbol: 'getTraceInfo', kind: 'function', owner: 'tracing' },

  // Cache primitives consumer apps instantiate
  { symbol: 'LRUCache', kind: 'class', owner: 'caches/LRUCache' },
  { symbol: 'DiskCache', kind: 'class', owner: 'caches/DiskCache' },
  { symbol: 'LRUDiskCache', kind: 'class', owner: 'caches/LRUDiskCache' },
  { symbol: 'MultilayeredCache', kind: 'class', owner: 'caches/MultilayeredCache' },
  { symbol: 'CacheType', kind: 'type-or-value', owner: 'caches' },
]

describe('@vtex/api public surface — preserved symbols (T018)', () => {
  it.each(PRESERVED_SYMBOLS)('$symbol ($kind, owner=$owner) is exported from @vtex/api', ({ symbol, kind, owner }) => {
    expect({
      symbol,
      kind,
      owner,
      present: symbol in publicApi,
    }).toEqual({
      symbol,
      kind,
      owner,
      present: true,
    })
  })

  it('the preservation list is non-empty (guards against accidental list-wipe)', () => {
    expect(PRESERVED_SYMBOLS.length).toBeGreaterThan(0)
  })
})
