import {
  NewTelemetryClient,
  Instrumentation,
  Exporters,
  Logs,
  Metrics,
  Traces,
} from '@vtex/diagnostics-nodejs';
import { APP } from '../../constants';
import { TelemetryClient } from '@vtex/diagnostics-nodejs/dist/telemetry';
import { KoaInstrumentation } from '@opentelemetry/instrumentation-koa';
import { HostMetricsInstrumentation } from '../metrics/instruments/hostMetrics';

const CLIENT_NAME = APP.NAME || 'node-vtex-api';
const APPLICATION_ID = APP.ID || 'vtex-io-app';
const EXPORTER_OTLP_ENDPOINT = process.env.EXPORTER_OTLP_ENDPOINT;

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
        endpoint: EXPORTER_OTLP_ENDPOINT,
      }), 'otlp'),
    });

  private initializeMetricsClient = async (telemetryClient: TelemetryClient) =>
    await telemetryClient.newMetricsClient({
      exporter: Exporters.CreateExporter(Exporters.CreateMetricsExporterConfig({
        endpoint: EXPORTER_OTLP_ENDPOINT,
        interval: 5,
        timeoutSeconds: 5,
      }), 'otlp'),
    });

  private initializeLogsClient = async (telemetryClient: TelemetryClient) =>
    await telemetryClient.newLogsClient({
      exporter: Exporters.CreateExporter(Exporters.CreateLogsExporterConfig({
        endpoint: EXPORTER_OTLP_ENDPOINT,
      }), 'otlp'),
      loggerName: `node-vtex-api-${APPLICATION_ID}`,
    });

  private async initializeTelemetryClients(): Promise<TelemetryClients> {
    try {
      const telemetryClient = await NewTelemetryClient(
        APPLICATION_ID,
        CLIENT_NAME,
        'node-vtex-api',
        {
          additionalAttrs: {
            'version': APP.VERSION || '',
            'environment': process.env.VTEX_WORKSPACE || 'development',
          },
        }
      );

      const tracesClient = await this.initializeTracesClient(telemetryClient);
      const metricsClient = await this.initializeMetricsClient(telemetryClient);
      const logsClient = await this.initializeLogsClient(telemetryClient);

      const instrumentations = [
        ...Instrumentation.CommonInstrumentations.minimal(),
        new KoaInstrumentation(),
        new HostMetricsInstrumentation({
          name: 'host-metrics-instrumentation',
          meterProvider: metricsClient.provider(),
        }),
      ];

      telemetryClient.registerInstrumentations(instrumentations);

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
