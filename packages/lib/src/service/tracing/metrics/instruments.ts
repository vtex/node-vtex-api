import { Counter, Gauge, Histogram } from 'prom-client'
import {
  BETWEEN_SCRAPES_EVENT_LOOP_LAG_MAX,
  BETWEEN_SCRAPES_EVENT_LOOP_LAG_PERCENTILES,
  CONCURRENT_REQUESTS,
  REQUEST_RESPONSE_SIZES,
  REQUEST_TIMINGS,
  REQUESTS_ABORTED,
  REQUESTS_TOTAL,
} from './MetricNames'
export { EventLoopMetricLabels, RequestsMetricLabels } from './MetricNames'

export const createTotalRequestsInstrument = () => new Counter(REQUESTS_TOTAL)
export const createTotalAbortedRequestsInstrument = () => new Counter(REQUESTS_ABORTED)
export const createRequestsTimingsInstrument = () => new Histogram(REQUEST_TIMINGS)
export const createRequestsResponseSizesInstrument = () => new Histogram(REQUEST_RESPONSE_SIZES)
export const createConcurrentRequestsInstrument = () => new Gauge(CONCURRENT_REQUESTS)
export const createEventLoopLagMaxInstrument = () => new Gauge(BETWEEN_SCRAPES_EVENT_LOOP_LAG_MAX)
export const createEventLoopLagPercentilesInstrument = () => new Gauge(BETWEEN_SCRAPES_EVENT_LOOP_LAG_PERCENTILES)
