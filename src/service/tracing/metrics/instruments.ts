import { Counter, Gauge, Histogram } from 'prom-client'
import {
  BETWEEN_SCRAPES_EVENT_LOOP_LAG_MAX,
  BETWEEN_SCRAPES_EVENT_LOOP_LAG_PERCENTILES,
  CONCURRENT_REQUESTS,
  FRONTEND_CLS,
  FRONTEND_FCP,
  FRONTEND_FID,
  FRONTEND_LCP,
  FRONTEND_TTFB,
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

export const createFrontendFCPInstrument = () => new Gauge(FRONTEND_FCP)
export const createFrontendCLSInstrument = () => new Gauge(FRONTEND_CLS)
export const createFrontendFIDInstrument = () => new Gauge(FRONTEND_FID)
export const createFrontendTTFBInstrument = () => new Gauge(FRONTEND_TTFB)
export const createFrontendLCPInstrument = () => new Gauge(FRONTEND_LCP)
