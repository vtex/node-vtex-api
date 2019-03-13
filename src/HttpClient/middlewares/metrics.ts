import { MetricsAccumulator } from '../../metrics/metricsAccumulator'
import { TIMEOUT_CODE } from '../../utils/Retry'
import { MiddlewareContext } from '../context'

const statusLabel = (status: number) =>
  `${Math.floor(status/100)}xx`

export const metricsMiddleware = (metrics: MetricsAccumulator) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const start = ctx.config.metric ? process.hrtime() : null
    let status

    try {
      await next()
      if (ctx.config.metric && ctx.response && ctx.response.status) {
        status = statusLabel(ctx.response.status)
      }
    } catch (err) {
      if (ctx.config.metric) {
        if (err.code === 'ECONNABORTED') {
          status = 'aborted'
        }
        else if (err.response && err.response.data && err.response.data.code === TIMEOUT_CODE) {
          status = 'timeout'
        }
        else if (err.response && err.response.status) {
          status = statusLabel(err.response.status)
        } else {
          status = 'error'
        }
      }
      throw err
    } finally {
      if (ctx.config.metric) {
        const label = `http-client-${status}-${ctx.config.metric}`
        metrics.batch(label, start as [number, number], ctx.cacheHit)

        if (ctx.config['axios-retry']) {
          const {retryCount} = ctx.config['axios-retry'] as any

          if (retryCount && retryCount > 0) {
            metrics.batch(`${label}-retry-${retryCount}`, start as [number, number], ctx.cacheHit)
          }
        }
      }
    }
  }
}
