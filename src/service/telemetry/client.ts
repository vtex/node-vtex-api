import {
  NewTelemetryClient,
  Instrumentation,
  Exporters,
  Logs,
  Metrics,
  Traces,
} from '@vtex/diagnostics-nodejs';
import { APP, OTEL_EXPORTER_OTLP_ENDPOINT, DK_APP_ID, DIAGNOSTICS_TELEMETRY_ENABLED, WORKSPACE, PRODUCTION, AttributeKeys } from '../../constants';
import { TelemetryClient } from '@vtex/diagnostics-nodejs/dist/telemetry';
import { HostMetricsInstrumentation } from '../metrics/instruments/hostMetrics';

// Optional dependency - may not be available in all environments
let KoaInstrumentation: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  KoaInstrumentation = require('@opentelemetry/instrumentation-koa').KoaInstrumentation;
} catch {
  // Module not available - will be handled when creating instrumentations
}

const APPLICATION_ID = APP.ID || 'vtex-io-app';

interface TelemetryClients {
  logsClient: Logs.LogClient;
  metricsClient: Metrics.MetricsClient;
  tracesClient: Traces.TraceClient;
}

class TelemetryClientSingleton {
  private static instance: TelemetryClientSingleton;
  private telemetryClients: TelemetryClients | undefined;
  private initializationPromise: Promise<TelemetryClients> | undefined = undefined;

  private constructor() {}

  public static getInstance(): TelemetryClientSingleton {
    if (!TelemetryClientSingleton.instance) {
      TelemetryClientSingleton.instance = new TelemetryClientSingleton();
    }
    return TelemetryClientSingleton.instance;
  }

  private initializeTracesClient = async (telemetryClient: TelemetryClient) =>
    await telemetryClient.newTracesClient({
      exporter: Exporters.CreateExporter(Exporters.CreateTracesExporterConfig({
        endpoint: OTEL_EXPORTER_OTLP_ENDPOINT,
      }), 'otlp'),
    });

  private initializeMetricsClient = async (telemetryClient: TelemetryClient) =>
    await telemetryClient.newMetricsClient({
      exporter: Exporters.CreateExporter(Exporters.CreateMetricsExporterConfig({
        endpoint: OTEL_EXPORTER_OTLP_ENDPOINT,
        interval: 60,
        timeoutSeconds: 60,
      }), 'otlp'),
    });

  private initializeLogsClient = async (telemetryClient: TelemetryClient) =>
    await telemetryClient.newLogsClient({
      exporter: Exporters.CreateExporter(Exporters.CreateLogsExporterConfig({
        endpoint: OTEL_EXPORTER_OTLP_ENDPOINT,
      }), 'otlp'),
      loggerName: `node-vtex-api-${APPLICATION_ID}`,
    });

  private async initializeTelemetryClients(): Promise<TelemetryClients> {

    try {
      const telemetryClient = await NewTelemetryClient(
        DK_APP_ID,
        'node-vtex-api',
        APPLICATION_ID,
        {
          additionalAttrs: {
            [AttributeKeys.VTEX_IO_APP_ID]: APPLICATION_ID,
            'vendor': APP.VENDOR,
            'version': APP.VERSION || '',
            [AttributeKeys.VTEX_IO_WORKSPACE_NAME]: WORKSPACE,
            [AttributeKeys.VTEX_IO_WORKSPACE_TYPE]: PRODUCTION.toString(),
          },
        }
      );

      const [tracesClient, metricsClient, logsClient] = await Promise.all([
        this.initializeTracesClient(telemetryClient),
        this.initializeMetricsClient(telemetryClient),
        this.initializeLogsClient(telemetryClient),
      ]);

      if (DIAGNOSTICS_TELEMETRY_ENABLED) {
        console.log(`Telemetry enabled for app: ${APP.ID} (vendor: ${APP.VENDOR})`);

        const instrumentations = [
          ...Instrumentation.CommonInstrumentations.minimal(),
          ...(KoaInstrumentation ? [new KoaInstrumentation()] : []),
          new HostMetricsInstrumentation({
            name: 'host-metrics-instrumentation',
            meterProvider: metricsClient.provider(),
          }),
        ];

        telemetryClient.registerInstrumentations(instrumentations);
      }

      const clients: TelemetryClients = {
        logsClient,
        metricsClient,
        tracesClient,
      };

      this.telemetryClients = clients;
      return clients;
    } catch (error) {
      console.error('Failed to initialize telemetry clients:', error);
      throw error;
    } finally {
      this.initializationPromise = undefined;
    }
  }

  public async getTelemetryClients(): Promise<TelemetryClients> {
    if (this.telemetryClients) {
      return this.telemetryClients;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeTelemetryClients();
    return this.initializationPromise;
  }

  public reset(): void {
    this.telemetryClients = undefined;
    this.initializationPromise = undefined;
  }
}

export async function initializeTelemetry(): Promise<TelemetryClients> {
  return TelemetryClientSingleton.getInstance().getTelemetryClients();
}

export function resetTelemetry(): void {
  TelemetryClientSingleton.getInstance().reset();
}
