// Ambient declarations for the two singletons the @vtex/api runtime
// installs onto the Node.js Global object at startup. Originally
// declared in service/index.ts (which moved to @vtex/api-runtime in
// Phase 3 of the monorepo split); kept here as a stub so the surviving
// lib code (DiagnosticsMetrics, MetricsAccumulator, request-stats and
// timings middlewares whose .ts files remain in lib until the deeper
// runtime/lib decoupling lands) still type-checks.
//
// These singletons are populated by @vtex/api-runtime/src/service/index.ts.
// Consumer apps that import @vtex/api standalone must NOT rely on them
// being defined — they are guarded with optional chaining in lib's code.

import type { MetricsAccumulator } from '../metrics/MetricsAccumulator'
import type { DiagnosticsMetrics } from '../metrics/DiagnosticsMetrics'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      metrics: MetricsAccumulator
      diagnosticsMetrics: DiagnosticsMetrics
    }
  }
}
