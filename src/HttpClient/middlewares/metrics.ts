import { compose, forEach, path, reduce, replace, split } from 'ramda'

import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import { hrToMillis, shouldForwardTimings } from '../../utils'
import { TIMEOUT_CODE } from '../../utils/retry'
import { statusLabel } from '../../utils/status'
import { MiddlewareContext } from '../typings'

const filterForwardableServerTimingsHeaders = (serverTimingsHeaderValue: string) => compose<string, string, string[], Array<[string, string]>>(
  reduce((acc, rawHeader) => {
    const [name, durStr] = rawHeader.split(';')
    const [_, dur] = durStr ? durStr.split('=') : [null, null]
    if (shouldForwardTimings(name) && dur && name) {
      acc.push([name, dur])
    }
    return acc
  }, [] as Array<[string, string]>),
  split(','),
  replace(/\s/g, '')
)(serverTimingsHeaderValue)

interface MetricsOpts {
  metrics?: MetricsAccumulator
  serverTiming?: Record<string, string>
  name?: string
}

export const metricsMiddleware = ({metrics, serverTiming, name}: MetricsOpts) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const start = process.hrtime()
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
      const end = process.hrtime(start as [number, number])
      if (ctx.config.metric && metrics) {
        const label = `http-client-${status}-${ctx.config.metric}`
        const extensions: Record<string, string | number> = {}

        if (ctx.cacheHit) {
          Object.assign(extensions, ctx.cacheHit)
        }

        if (ctx.config['axios-retry']) {
          const {retryCount} = ctx.config['axios-retry'] as any

          if (retryCount && retryCount > 0) {
            extensions[`retry-${retryCount}`] = 1
          }
        }

        metrics.batch(label, end, extensions)
      }
      if (serverTiming) {
        // Timings in the client's perspective
        const label = `${name || 'unknown'}.client`
        const dur = `${hrToMillis(end)}`
        if (!serverTiming[label] || serverTiming[label] < dur) {
          serverTiming[label] = dur
        }

        // Timings in the servers's perspective
        const serverTimingsHeader = path<string>(['response', 'headers', 'server-timing'], ctx)
        if (serverTimingsHeader) {
          const forwardableTimings = filterForwardableServerTimingsHeaders(serverTimingsHeader)
          forEach(
            ([timingsName, timingsDur]) => {
              if (!serverTiming[timingsName] || serverTiming[timingsName] < dur) {
                serverTiming[timingsName] = timingsDur
              }
            },
            forwardableTimings
          )
        }
      }
    }
  }
}
