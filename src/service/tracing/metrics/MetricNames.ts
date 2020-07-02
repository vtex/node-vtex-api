export const enum MetricLabels {
  /** The status code for the HTTP request */
  STATUS_CODE = 'status_code',

  /** The service.json handler name for the current request (e.g. 'public-handler:render') */
  REQUEST_HANDLER = 'handler',
}

const enum METRIC_TYPES {
  /** Counter is monotonic */
  COUNTER = 'counter',
  /** Gauge is a counter that can be increased and decreased */
  GAUGE = 'gauge',
  /** Histogram creates a counter timeseries for each bucket specified */
  HISTOGRAM = 'histogram',
}

export const CONCURRENT_REQUESTS = {
  name: 'io_http_requests_current',
  help: 'The current number of requests in course.',
  type: METRIC_TYPES.GAUGE,
}

export const REQUESTS_TOTAL = {
  name: 'runtime_http_requests_total',
  help: 'The total number of HTTP requests.',
  labelNames: [MetricLabels.STATUS_CODE, MetricLabels.REQUEST_HANDLER],
  type: METRIC_TYPES.COUNTER,
}

export const REQUESTS_ABORTED = {
  name: 'runtime_http_aborted_requests_total',
  help: 'The total number of HTTP requests aborted.',
  labelNames: [MetricLabels.REQUEST_HANDLER],
  type: METRIC_TYPES.COUNTER,
}

export const REQUEST_TIMINGS = {
  name: 'runtime_http_requests_duration_milliseconds',
  help: 'The incoming http requests total duration.',
  labelNames: [MetricLabels.REQUEST_HANDLER],
  buckets: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  type: METRIC_TYPES.HISTOGRAM,
}

export const REQUEST_RESPONSE_SIZES = {
  name: 'runtime_http_response_size_bytes',
  help: `The outgoing response sizes (only applicable when the response isn't a stream).`,
  labelNames: [MetricLabels.REQUEST_HANDLER],
  buckets: [500, 2000, 8000, 16000, 64000, 256000, 1024000, 4096000],
  type: METRIC_TYPES.HISTOGRAM,
}
