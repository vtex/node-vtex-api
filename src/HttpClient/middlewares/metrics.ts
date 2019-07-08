import { compose, forEach, path, reduce, replace, split, values } from 'ramda'

import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import { formatTimingName, hrToMillis, parseTimingName, shrinkTimings } from '../../utils'
import { TIMEOUT_CODE } from '../../utils/retry'
import { statusLabel } from '../../utils/status'
import { MiddlewareContext } from '../typings'

const parseServerTiming = (serverTimingsHeaderValue: string) => compose<string, string, string[], Array<[string, string]>>(
  reduce((acc, rawHeader) => {
    const [name, durStr] = rawHeader.split(';')
    const [_, dur] = durStr ? durStr.split('=') : [null, null]
    const {hopNumber, source, target} = parseTimingName(name)
    const formatted = formatTimingName({
      hopNumber: Number.isNaN(hopNumber as any) ? null : hopNumber! + 1,
      source,
      target,
    })
    if (dur && formatted) {
      acc.push([formatted, dur])
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
  const serverTimingStart = process.hrtime()
  const serverTimingLabel = shrinkTimings(formatTimingName({
    hopNumber: 0,
    source: process.env.VTEX_APP_NAME!,
    target: name || 'unknown',
  }))
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
      const end = process.hrtime(start)
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
      const cacheHit = ctx.cacheHit && values(ctx.cacheHit).reduce((a, b) => a || b !== 0, false)
      if (!cacheHit && serverTiming) {

        // Timings in the client's perspective
        const dur = hrToMillis(process.hrtime(serverTimingStart))
        if (!serverTiming[serverTimingLabel] || Number(serverTiming[serverTimingLabel]) < dur) {
          serverTiming[serverTimingLabel] = `${dur}`
        }

        // Forward server timings
        const serverTimingsHeader = path<string>(['response', 'headers', 'server-timing'], ctx)
        if (serverTimingsHeader) {
          const parsedServerTiming = parseServerTiming(serverTimingsHeader)
          forEach(
            ([timingsName, timingsDur]) => {
              if (!serverTiming[timingsName] || Number(serverTiming[timingsName]) < Number(timingsDur)) {
                serverTiming[timingsName] = timingsDur
              }
            },
            parsedServerTiming
          )
        }
      }
    }
  }
}
