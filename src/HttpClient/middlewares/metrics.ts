import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import { TIMEOUT_CODE } from '../../utils/retry'
import { statusLabel } from '../../utils/status'
import { MiddlewareContext } from '../typings'

export const metricsMiddleware = (metrics: MetricsAccumulator) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const start = ctx.config.metric ? process.hrtime() : null
    let status: string = 'unknown'

    try {
      await next()
      if (ctx.config.metric && ctx.response && ctx.response.status) {
        status = statusLabel(ctx.response.status)
      }
    } catch (err) {
      if (ctx.config.metric) {
        if (err.code === 'ECONNABORTED') {
          status = 'aborted'
        } else if (err.response && err.response.data && err.response.data.code === TIMEOUT_CODE) {
          status = 'timeout'
        } else if (err.response && err.response.status) {
          status = statusLabel(err.response.status)
        } else {
          status = 'error'
        }
      }
      throw err
    } finally {
      if (ctx.config.metric) {
        const end = process.hrtime(start as [number, number])
        const label = `http-client-${status}-${ctx.config.metric}`
        const extensions: Record<string, string | number> = {}

        if (ctx.cacheHit) {
          Object.assign(extensions, ctx.cacheHit)
        }

        if (ctx.config['axios-retry']) {
          const { retryCount } = ctx.config['axios-retry'] as any

          if (retryCount && retryCount > 0) {
            extensions[`retry-${retryCount}`] = 1
          }
        }

        metrics.batch(label, end, extensions)
      }
    }
  }
}
