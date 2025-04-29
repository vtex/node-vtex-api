import { Exporters } from '@vtex/diagnostics-nodejs';
import { LogClient } from '@vtex/diagnostics-nodejs/dist/types';
import { getTelemetryClient } from '../telemetry';

let logClient: LogClient | undefined;
let isInitializing = false;
let initPromise: Promise<LogClient> | undefined = undefined;

export async function getLogClient(account: string, workspace: string, appName: string): Promise<LogClient> {

  if (logClient) {
    return logClient;
  }

  if (initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = initializeClient(account, workspace, appName);

  return initPromise;
}

async function initializeClient(account: string, workspace: string, appName: string): Promise<LogClient> {
  try {
    const telemetryClient = await getTelemetryClient();

    const logsConfig = Exporters.CreateLogsExporterConfig({
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      path: process.env.OTEL_EXPORTER_OTLP_PATH || '/v1/logs',
      protocol: 'http',
      interval: 5,
      timeoutSeconds: 5,
      headers: { 'Content-Type': 'application/json' },
    });

    const logsExporter = Exporters.CreateExporter(logsConfig, 'otlp');
    await logsExporter.initialize();

    const clientKey = `${account}-${workspace}-${appName}`;
    logClient = await telemetryClient.newLogsClient({
      exporter: logsExporter,
      loggerName: `node-vtex-api-${clientKey}`,
    });

    return logClient;
  } catch (error) {
    console.error('Failed to initialize logs client:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}
