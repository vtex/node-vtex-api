import { Types } from '@vtex/diagnostics-nodejs'
import { getMetricClient } from './client'

export const enum RequestsMetricLabels {
  STATUS_CODE = 'status_code',
  REQUEST_HANDLER = 'handler',
}

export interface OtelRequestInstruments {
  concurrentRequests: Types.Gauge
  requestTimings: Types.Histogram
  totalRequests: Types.Counter
  responseSizes: Types.Histogram
  abortedRequests: Types.Counter
}

let instruments: OtelRequestInstruments | undefined
let initializingPromise: Promise<OtelRequestInstruments> | undefined

const createOtelConcurrentRequestsInstrument = async (): Promise<Types.Gauge> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createGauge('io_http_requests_current', {
    description: 'The current number of requests in course.',
    unit: '1'
  })
}

const createOtelRequestsTimingsInstrument = async (): Promise<Types.Histogram> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createHistogram('runtime_http_requests_duration_milliseconds', {
    description: 'The incoming http requests total duration.',
    unit: 'ms'
  })
}

const createOtelTotalRequestsInstrument = async (): Promise<Types.Counter> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createCounter('runtime_http_requests_total', {
    description: 'The total number of HTTP requests.',
    unit: '1'
  })
}

const createOtelRequestsResponseSizesInstrument = async (): Promise<Types.Histogram> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createHistogram('runtime_http_response_size_bytes', {
    description: 'The outgoing response sizes (only applicable when the response isn\'t a stream).',
    unit: 'bytes'
  })
}

const createOtelTotalAbortedRequestsInstrument = async (): Promise<Types.Counter> => {
  const metricsClient = await getMetricClient()
  return metricsClient.createCounter('runtime_http_aborted_requests_total', {
    description: 'The total number of HTTP requests aborted.',
    unit: '1'
  })
}

export const getOtelInstruments = async (): Promise<OtelRequestInstruments> => {
  if (instruments) {
    return instruments
  }

  if (initializingPromise) {
    return initializingPromise
  }

  initializingPromise = initializeOtelInstruments()

  try {
    instruments = await initializingPromise
    return instruments
  } finally {
    initializingPromise = undefined
  }
}

const initializeOtelInstruments = async (): Promise<OtelRequestInstruments> => {
  const [
    concurrentRequests,
    requestTimings,
    totalRequests,
    responseSizes,
    abortedRequests
  ] = await Promise.all([
    createOtelConcurrentRequestsInstrument(),
    createOtelRequestsTimingsInstrument(),
    createOtelTotalRequestsInstrument(),
    createOtelRequestsResponseSizesInstrument(),
    createOtelTotalAbortedRequestsInstrument()
  ])

  return {
    concurrentRequests,
    requestTimings,
    totalRequests,
    responseSizes,
    abortedRequests
  }
}
