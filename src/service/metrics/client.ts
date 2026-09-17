import { Types } from '@vtex/diagnostics-nodejs'
import { initializeTelemetry } from '../telemetry'

class MetricClientSingleton {
  private static instance: MetricClientSingleton | undefined
  private client: Types.MetricClient | undefined
  private initPromise: Promise<Types.MetricClient> | undefined

  private constructor() {}

  public static getInstance(): MetricClientSingleton {
    if (!MetricClientSingleton.instance) {
      MetricClientSingleton.instance = new MetricClientSingleton()
    }
    return MetricClientSingleton.instance
  }

  public async getClient(): Promise<Types.MetricClient> {
    if (this.client) {
      return this.client
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.initializeClient()

    return this.initPromise
  }

  private async initializeClient(): Promise<Types.MetricClient> {
    try {
      const { metricsClient } = await initializeTelemetry()
      this.client = metricsClient
      this.initPromise = undefined
      return metricsClient
    } catch (error) {
      console.error('Failed to initialize metrics client:', error)
      this.initPromise = undefined
      throw error
    }
  }
}

export const getMetricClient = () => MetricClientSingleton.getInstance().getClient()
