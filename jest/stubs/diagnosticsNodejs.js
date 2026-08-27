// Test stub for `@vtex/diagnostics-nodejs`.
//
// The 6.x toolchain pins `jest@25`, whose module resolver predates the package
// `exports` field. `@vtex/diagnostics-nodejs` pulls in modern OpenTelemetry
// exporter packages that expose their entry points only through `exports`
// subpaths (e.g. `@opentelemetry/otlp-exporter-base/node-http`), which jest@25
// cannot resolve. Because `src/service/logger` (imported transitively by nearly
// every service module) loads that chain at module-evaluation time, any test
// touching a service module fails to even load under jest@25.
//
// The real telemetry / log-client paths are lazy and error-guarded (see
// `src/service/logger/logger.ts` and `src/service/telemetry/client.ts`), so
// tests only need the named exports to exist for module evaluation. This stub
// provides just enough surface for that, with no behavioural effect on the code
// under test.
module.exports = {
  Exporters: {
    CreateExporter: () => ({ initialize: async () => undefined }),
    CreateLogsExporterConfig: () => ({}),
  },
  NewTelemetryClient: async () => ({
    newLogsClient: async () => ({}),
  }),
}
