process.env.FORCE_COLOR = '1'

// ---------------------------------------------------------------------------
// PHASE 3 / WORKSTREAM C — TRANSITIONAL INTERNAL RE-EXPORTS
// ---------------------------------------------------------------------------
// The following named exports are NOT part of @vtex/api's documented public
// API. They exist on the surface only because @vtex/api-runtime (workstream
// C) was carved out of this package in Phase 3 of the monorepo split and
// still needs cross-package access to a handful of internal helpers.
//
// Each entry is annotated with the runtime file that pulls it in. T024
// will revisit this block once the carved runtime no longer depends on
// any of these symbols, OR — for the truly cross-cutting ones (e.g.
// HttpAgentSingleton, where a single process-wide instance is required) —
// promote them to a documented `@internal` subpath.
//
// DO NOT rely on any name in this block from a consumer app.
// ---------------------------------------------------------------------------
export { HttpAgentSingleton } from './HttpClient/middlewares/request/HttpAgentSingleton' // runtime: service/worker/runtime/statusTrack.ts
export { MetricsLogger } from './service/logger/metricsLogger' // runtime: service/worker/runtime/builtIn/middlewares.ts
export { statusLabel } from './utils/status' // runtime: service/worker/runtime/http/middlewares/timings.ts
export { cancel } from './utils/cancel' // runtime: service/worker/runtime/utils/compose.ts
export { UserLandTracer } from './tracing/UserLandTracer' // runtime: service/tracing/tracingMiddlewares.ts, service/worker/runtime/utils/context.ts
export {
  AppTags,
  CustomHttpTags,
  OpentracingTags,
  VTEXIncomingRequestTags,
} from './tracing/Tags' // runtime: service/tracing/tracingMiddlewares.ts
export { RuntimeLogEvents } from './tracing/LogEvents' // runtime: service/tracing/tracingMiddlewares.ts
export { RuntimeLogFields } from './tracing/LogFields' // runtime: service/tracing/tracingMiddlewares.ts
export { cloneAndSanitizeHeaders } from './tracing/utils' // runtime: service/tracing/tracingMiddlewares.ts
export { IOMessage } from './utils/message' // runtime: graphql/utils/translations.ts and typings re-imports
export { BindingHeader } from './utils/binding' // runtime: typings re-imports
export { TenantHeader } from './utils/tenant' // runtime: typings re-imports

// ---------------------------------------------------------------------------
// Stable public re-exports — these are @vtex/api's contract.
// ---------------------------------------------------------------------------
export * from './caches'
export * from './clients'
export * from './errors'
export * from './HttpClient'
export * from './metrics/MetricsAccumulator'
export * from './metrics/DiagnosticsMetrics'
export * from './responses'
export * from './service/worker/runtime/Service'
export * from './service/worker/runtime/method'
export * from './service/worker/runtime/typings'
export * from './service/worker/runtime/graphql/schema/schemaDirectives'
export * from './service/worker/runtime/graphql/schema/messagesLoaderV2'
export * from './service/worker/runtime/utils/recorder'
export * from './service'
export * from './service/logger'
export * from './utils'
export * from './constants'
export * from './tracing'

