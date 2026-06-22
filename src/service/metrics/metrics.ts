import { Types } from '@vtex/diagnostics-nodejs'
import { AttributeKeys } from '../../constants'
import { getMetricClient } from './client'

export const RequestsMetricLabels = {
  ACCOUNT_NAME: AttributeKeys.VTEX_ACCOUNT_NAME,
  REQUEST_HANDLER: 'handler',
  STATUS_CODE: 'status_code',
} as const

export interface OtelRequestInstruments {
  concurrentRequests: Types.Gauge
  requestTimings: Types.Histogram
  totalRequests: Types.Counter
  responseSizes: Types.Histogram
  abortedRequests: Types.Counter
}

const createOtelConcurrentRequestsInstrument = async (): Promise<Types.Gauge> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createGauge('io_http_requests_current', {
    description: 'The current number of requests in course.',
    unit: '1',
  })
}

const createOtelRequestsTimingsInstrument = async (): Promise<Types.Histogram> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createHistogram('runtime_http_requests_duration_milliseconds', {
    description: 'The incoming http requests total duration.',
    unit: 'ms',
  })
}

const createOtelTotalRequestsInstrument = async (): Promise<Types.Counter> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createCounter('runtime_http_requests_total', {
    description: 'The total number of HTTP requests.',
    unit: '1',
  })
}

const createOtelRequestsResponseSizesInstrument = async (): Promise<Types.Histogram> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createHistogram('runtime_http_response_size_bytes', {
    description: 'The outgoing response sizes (only applicable when the response isn\'t a stream).',
    unit: 'bytes',
  })
}

const createOtelTotalAbortedRequestsInstrument = async (): Promise<Types.Counter> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createCounter('runtime_http_aborted_requests_total', {
    description: 'The total number of HTTP requests aborted.',
    unit: '1',
  })
}

class OtelInstrumentsSingleton {
  public static getInstance(): OtelInstrumentsSingleton {
    if (!OtelInstrumentsSingleton.instance) {
      OtelInstrumentsSingleton.instance = new OtelInstrumentsSingleton()
    }
    return OtelInstrumentsSingleton.instance
  }

  private static instance: OtelInstrumentsSingleton | undefined
  private instruments: OtelRequestInstruments | undefined
  private initializingPromise: Promise<OtelRequestInstruments> | undefined

  private constructor() {}

  public async getInstruments(): Promise<OtelRequestInstruments> {
    if (this.instruments) {
      return this.instruments
    }

    if (this.initializingPromise) {
      return this.initializingPromise
    }

    this.initializingPromise = this.initializeInstruments()

    try {
      this.instruments = await this.initializingPromise
      return this.instruments
    } catch (error) {
      console.error('Failed to initialize OTel instruments:', error)
      this.initializingPromise = undefined
      throw error
    } finally {
      this.initializingPromise = undefined
    }
  }

  private async initializeInstruments(): Promise<OtelRequestInstruments> {
    const [
      concurrentRequests,
      requestTimings,
      totalRequests,
      responseSizes,
      abortedRequests,
    ] = await Promise.all([
      createOtelConcurrentRequestsInstrument(),
      createOtelRequestsTimingsInstrument(),
      createOtelTotalRequestsInstrument(),
      createOtelRequestsResponseSizesInstrument(),
      createOtelTotalAbortedRequestsInstrument(),
    ])

    return {
      abortedRequests,
      concurrentRequests,
      requestTimings,
      responseSizes,
      totalRequests,
    }
  }
}

export const getOtelInstruments = () => OtelInstrumentsSingleton.getInstance().getInstruments()
