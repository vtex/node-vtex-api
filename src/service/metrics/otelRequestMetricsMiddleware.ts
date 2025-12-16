import { finished as onStreamFinished } from 'stream'
import { hrToMillisFloat } from '../../utils'
import { getOtelInstruments, RequestsMetricLabels, OtelRequestInstruments } from './metrics'
import { ServiceContext } from '../worker/runtime/typings'

const INSTRUMENTS_INITIALIZATION_TIMEOUT = 500

export const addOtelRequestMetricsMiddleware = () => {
  let instruments: OtelRequestInstruments | undefined

  const tryGetInstruments = async (ctx: ServiceContext): Promise<OtelRequestInstruments | undefined> => {
    try {
      return await Promise.race([
        getOtelInstruments(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout waiting for OpenTelemetry instruments initialization')),
            INSTRUMENTS_INITIALIZATION_TIMEOUT
          )
        ),
      ])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(`OpenTelemetry instruments not ready for request ${ctx.requestHandlerName}: ${errorMessage}`)
      return undefined
    }
  }

  return async function addOtelRequestMetrics(ctx: ServiceContext, next: () => Promise<void>) {
    instruments = instruments ? instruments : await tryGetInstruments(ctx)
    if (!instruments) {
      await next()
      return
    }

    const start = process.hrtime()
    instruments.concurrentRequests.add(1)

    ctx.req.once('aborted', () => {
      if (instruments) {
        instruments.abortedRequests.add(1, { [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName })
      }
    })

    let responseClosed = false
    ctx.res.once('close', () => (responseClosed = true))

    try {
      await next()
    } finally {
      const responseLength = ctx.response.length
      if (responseLength && instruments) {
        instruments.responseSizes.record(
          responseLength,
          {
            [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName,
            [RequestsMetricLabels.STATUS_CODE]: ctx.response.status,
            [RequestsMetricLabels.ACCOUNT_NAME]: ctx.vtex?.account || 'unknown',
          }
        )
      }

      if (instruments) {
        instruments.totalRequests.add(
          1,
          {
            [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName,
            [RequestsMetricLabels.STATUS_CODE]: ctx.response.status,
            [RequestsMetricLabels.ACCOUNT_NAME]: ctx.vtex?.account || 'unknown',
          }
        )
      }

      const onResFinished = () => {
        if (instruments) {
          instruments.requestTimings.record(
            hrToMillisFloat(process.hrtime(start)),
            {
              [RequestsMetricLabels.REQUEST_HANDLER]: ctx.requestHandlerName,
              [RequestsMetricLabels.STATUS_CODE]: ctx.response.status,
              [RequestsMetricLabels.ACCOUNT_NAME]: ctx.vtex?.account || 'unknown',
            }
          )

          instruments.concurrentRequests.subtract(1)
        }
      }

      if (responseClosed) {
        onResFinished()
      } else {
        onStreamFinished(ctx.res, onResFinished)
      }
    }
  }
}
