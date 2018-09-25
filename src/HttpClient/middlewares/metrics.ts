import {MetricsAccumulator} from '../../MetricsAccumulator'
import {MiddlewareContext} from '../context'

const statusLabel = (status: number) =>
  `${Math.floor(status/100)}xx`

export const metricsMiddleware = (metrics: MetricsAccumulator) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const start = ctx.config.metric && process.hrtime()
    const production = ctx.config.production || false
    let status

    try {
      await next()
      if (ctx.response && ctx.response.status && ctx.config.metric) {
        status = statusLabel(ctx.response.status)
      }
    } catch (err) {
      if (err.response && err.response.status && ctx.config.metric) {
        status = statusLabel(err.response.status)
      } else if (err.code === 'ECONNABORTED') {
        status = 'timeout'
      } else {
        status = 'error'
      }
      throw err
    } finally {
      if (ctx.config.metric) {
        metrics.batchHrTimeMetric(`http-client-${ctx.config.metric}-${status}`, start as [number, number], production)
      }
    }
  }
}
