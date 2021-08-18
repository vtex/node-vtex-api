export const enum METRIC_TYPES {
  /** Counter is monotonic */
  COUNTER = 'counter',
  /** Gauge is a counter that can be increased and decreased */
  GAUGE = 'gauge',
  /** Histogram creates a counter timeseries for each bucket specified */
  HISTOGRAM = 'histogram',
}

/* tslint:disable:object-literal-sort-keys */
export const enum RequestsMetricLabels {
  /** The status code for the HTTP request */
  STATUS_CODE = 'status_code',

  /** The service.json handler name for the current request (e.g. 'public-handler:render') */
  REQUEST_HANDLER = 'handler',
}

/* tslint:disable:object-literal-sort-keys */
export const enum EventLoopMetricLabels {
  PERCENTILE = 'percentile',
}

export const CONCURRENT_REQUESTS = {
  name: 'io_http_requests_current',
  help: 'The current number of requests in course.',
  type: METRIC_TYPES.GAUGE,
}

export const REQUESTS_TOTAL = {
  name: 'runtime_http_requests_total',
  help: 'The total number of HTTP requests.',
  labelNames: [RequestsMetricLabels.STATUS_CODE, RequestsMetricLabels.REQUEST_HANDLER],
  type: METRIC_TYPES.COUNTER,
}

export const REQUESTS_ABORTED = {
  name: 'runtime_http_aborted_requests_total',
  help: 'The total number of HTTP requests aborted.',
  labelNames: [RequestsMetricLabels.REQUEST_HANDLER],
  type: METRIC_TYPES.COUNTER,
}

export const REQUEST_TIMINGS = {
  name: 'runtime_http_requests_duration_milliseconds',
  help: 'The incoming http requests total duration.',
  labelNames: [RequestsMetricLabels.REQUEST_HANDLER],
  buckets: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  type: METRIC_TYPES.HISTOGRAM,
}

export const REQUEST_RESPONSE_SIZES = {
  name: 'runtime_http_response_size_bytes',
  help: `The outgoing response sizes (only applicable when the response isn't a stream).`,
  labelNames: [RequestsMetricLabels.REQUEST_HANDLER],
  buckets: [500, 2000, 8000, 16000, 64000, 256000, 1024000, 4096000],
  type: METRIC_TYPES.HISTOGRAM,
}

export const BETWEEN_SCRAPES_EVENT_LOOP_LAG_MAX = {
  name: 'runtime_event_loop_lag_max_between_scrapes_seconds',
  help: 'The max event loop lag that occurred between this and the previous scrape',
  type: METRIC_TYPES.GAUGE,
}

export const BETWEEN_SCRAPES_EVENT_LOOP_LAG_PERCENTILES = {
  name: 'runtime_event_loop_lag_percentiles_between_scrapes_seconds',
  help: 'Event loop lag percentiles from the observations that occurred between this and the previous scrape',
  labelNames: [EventLoopMetricLabels.PERCENTILE],
  type: METRIC_TYPES.GAUGE,
}

export const FRONTEND_CLS_BY_SENDER = {
  help: 'CLS',
  name: 'frontend_cls_by_sender',
  type: METRIC_TYPES.HISTOGRAM,
  buckets: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  labelNames: ['sender'],
}

export const FRONTEND_FCP_BY_SENDER = {
  help: 'FCP',
  name: 'frontend_fcp_by_sender',
  type: METRIC_TYPES.HISTOGRAM,
  buckets: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  labelNames: ['sender'],
}

export const FRONTEND_LCP_BY_SENDER = {
  help: 'LCP',
  name: 'frontend_lcp_by_sender',
  buckets: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  labelNames: ['sender'],
  type: METRIC_TYPES.HISTOGRAM,
}

export const FRONTEND_TTFB_BY_SENDER = {
  help: 'TTFB',
  name: 'frontend_ttfb_by_sender',
  buckets: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  labelNames: ['sender'],
  type: METRIC_TYPES.HISTOGRAM,
}

export const FRONTEND_FID_BY_SENDER = {
  help: 'TTFB',
  name: 'frontend_fid_by_sender',
  buckets: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],
  labelNames: ['sender'],
  type: METRIC_TYPES.HISTOGRAM,
}
