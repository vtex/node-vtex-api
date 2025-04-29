import { NewTelemetryClient } from '@vtex/diagnostics-nodejs';
import { TelemetryClient } from '@vtex/diagnostics-nodejs/dist/telemetry';
import { APP } from '../../constants';

class TelemetryClientSingleton {
  private static instance: TelemetryClientSingleton;
  private telemetryClient: TelemetryClient | undefined;
  private initializationPromise: Promise<TelemetryClient> | undefined = undefined;

  private constructor() {}

  public static getInstance(): TelemetryClientSingleton {
    if (!TelemetryClientSingleton.instance) {
      TelemetryClientSingleton.instance = new TelemetryClientSingleton();
    }
    return TelemetryClientSingleton.instance;
  }

  private async initTelemetryClient(): Promise<TelemetryClient> {
    try {
      const telemetryClient = await NewTelemetryClient(
        'node-vtex-api',
        APP.ID || 'vtex-app',
        {
          additionalAttrs: {
            'version': APP.VERSION || '',
            'environment': process.env.VTEX_WORKSPACE || 'development',
          },
        }
      );

      this.telemetryClient = telemetryClient;
      return telemetryClient;
    } catch (error) {
      console.error('Failed to initialize telemetry client:', error);
      throw error;
    } finally {
      this.initializationPromise = undefined;
    }
  }

  public async getClient(): Promise<TelemetryClient> {
    if (this.telemetryClient) {
      return this.telemetryClient;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initTelemetryClient();

    return this.initializationPromise;
  }

  public reset(): void {
    this.telemetryClient = undefined;
    this.initializationPromise = undefined;
  }

}

export async function getTelemetryClient(): Promise<TelemetryClient> {
  return TelemetryClientSingleton.getInstance().getClient();
}

export function resetTelemetryClient(): void {
  TelemetryClientSingleton.getInstance().reset();
}
