import { Types } from "@vtex/diagnostics-nodejs";
import { initializeTelemetry } from '../telemetry';

let client: Types.MetricClient | undefined;
let isInitializing = false;
let initPromise: Promise<Types.MetricClient> | undefined = undefined;

export async function getMetricClient(): Promise<Types.MetricClient> {
  if (client) {
    return client;
  }

  if (initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = initializeClient();

  return initPromise;
}
async function initializeClient(): Promise<Types.MetricClient> {
  try {
    const { metricsClient } = await initializeTelemetry();
    client = metricsClient;
    initPromise = undefined;
    return metricsClient;
  } catch (error) {
    console.error('Failed to initialize metrics client:', error);
    initPromise = undefined;
    throw error;
  } finally {
    isInitializing = false;
  }
}
