import { finished as onStreamFinished } from 'stream'
import { hrToMillisFloat } from '../../utils'
import {
  createConcurrentRequestsInstrument,
  createRequestsResponseSizesInstrument,
  createRequestsTimingsInstrument,
  createTotalAbortedRequestsInstrument,
  createTotalRequestsInstrument,
  RequestsMetricLabels,
} from '../tracing/metrics/instruments'
import { ServiceContext } from '../worker/runtime/typings'


export const addRequestMetricsMiddleware = () => {
  const concurrentRequests = createConcurrentRequestsInstrument()
  const requestTimings = createRequestsTimingsInstrument()
  const totalRequests = createTotalRequestsInstrument()
  const responseSizes = createRequestsResponseSizesInstrument()
  const abortedRequests = createTotalAbortedRequestsInstrument()

  return async function addRequestMetrics(ctx: ServiceContext, next: () => Promise<void>) {
    const start = process.hrtime()
    concurrentRequests.inc(1)

    ctx.req.once('aborted', () =>
      abortedRequests.inc({ [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName }, 1)
    )

    let responseClosed = false
    ctx.res.once('close', () => (responseClosed = true))

    try {
      await next()
    } finally {
      const responseLength = ctx.response.length
      if (responseLength) {
        responseSizes.observe(
          { [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName },
          responseLength
        )
      }

      totalRequests.inc(
        {
          [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName,
          [RequestsMetricLabels.STATUS_CODE]: ctx.response.status,
        },
        1
      )

      const onResFinished = () => {
        requestTimings.observe(
          {
            [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName,
          },
          hrToMillisFloat(process.hrtime(start))
        )

        concurrentRequests.dec(1)
      }

      if (responseClosed) {
        onResFinished()
      } else {
        onStreamFinished(ctx.res, onResFinished)
      }
    }
  }
}

