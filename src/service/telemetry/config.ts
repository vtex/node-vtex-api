import { ExporterOptions, TelemetryType } from "@vtex/diagnostics-nodejs/dist/types";

export const TELEMETRY_COMMON_CONFIG = {
  exporters: {
    endpoints: {
      metrics: process.env.OTEL_METRICS_EXPORTER_OTLP_ENDPOINT,
      logs: process.env.OTEL_LOGS_EXPORTER_OTLP_ENDPOINT,
    },
    paths: {
      metrics: process.env.OTEL_METRICS_EXPORTER_OTLP_PATH || '/v1/metrics',
      logs: process.env.OTEL_LOGS_EXPORTER_OTLP_PATH || '/v1/logs',
    },
    protocol: 'http' as const,
    interval: 5,
    timeoutSeconds: 5,
    headers: { 'Content-Type': 'application/json' },
  }
}

export function createExporterConfig(type: TelemetryType): ExporterOptions {
  const baseConfig = {
    protocol: TELEMETRY_COMMON_CONFIG.exporters.protocol,
    interval: TELEMETRY_COMMON_CONFIG.exporters.interval,
    timeoutSeconds: TELEMETRY_COMMON_CONFIG.exporters.timeoutSeconds,
    headers: TELEMETRY_COMMON_CONFIG.exporters.headers,
  };

  switch (type) {
    case TelemetryType.METRICS:
      return {
        ...baseConfig,
        endpoint: TELEMETRY_COMMON_CONFIG.exporters.endpoints.metrics!,
        path: TELEMETRY_COMMON_CONFIG.exporters.paths.metrics,
      };
    case TelemetryType.LOGS:
      return {
        ...baseConfig,
        endpoint: TELEMETRY_COMMON_CONFIG.exporters.endpoints.logs!,
        path: TELEMETRY_COMMON_CONFIG.exporters.paths.logs,
      };
    default:
      throw new Error(`Unknown exporter type: ${type}`);
  }
}
