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
    let errorCode: any
    let errorStatus: any

    try {

      if (ctx.config.verbose && ctx.config.label) {
        console.log(ctx.config.label, `start`)
      }

      await next()
      if (ctx.config.metric && ctx.response && ctx.response.status) {
        status = statusLabel(ctx.response.status)
      }
    } catch (err) {
      if (ctx.config.metric) {
        errorCode = err.code
        errorStatus = err.response && err.response.status

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
      if (ctx.config.metric && metrics) {
        const label = `http-client-${ctx.config.metric}`
        const extensions: Record<string, string | number> = {}

        Object.assign(extensions, {[status]: 1})

        if (ctx.cacheHit) {
          Object.assign(extensions, ctx.cacheHit, {[`${status}-hit`]: 1})
        } else if (!ctx.inflightHit && !ctx.memoizedHit) {
          // Lets us know how many calls passed through to origin
          Object.assign(extensions, {[`${status}-miss`]: 1})
        }

        if (ctx.inflightHit) {
          Object.assign(extensions, {[`${status}-inflight`]: 1})
        }

        if (ctx.memoizedHit) {
          Object.assign(extensions, {[`${status}-memoized`]: 1})
        }

        if (ctx.config['axios-retry']) {
          const {retryCount} = ctx.config['axios-retry'] as any

          if (retryCount && retryCount > 0) {
            extensions[`retry-${status}-${retryCount}`] = 1
          }
        }

        const end = status === 'success' && !ctx.cacheHit && !ctx.inflightHit && !ctx.memoizedHit
          ? process.hrtime(start)
          : undefined

        metrics.batch(label, end, extensions)

        if (ctx.config.verbose) {
          console.log(`VERBOSE: ${name}#${label}`, {
            ...extensions,
            ...errorCode || errorStatus ? {errorCode, errorStatus} : null,
            millis: end ? hrToMillis(end) : '(from cache)',
            status: ctx.response && ctx.response.status, // tslint:disable-next-line
            headers: ctx.response && ctx.response.headers,
          })
        }
      } else {
        if (ctx.config.verbose) {
          console.warn(`PROTIP: Please add a metric property to ${name} client request to get metrics in Splunk`, {baseURL: ctx.config.baseURL, url: ctx.config.url})
        }
      }
      if (serverTiming) {
        // Timings in the client's perspective
        const dur = hrToMillis(process.hrtime(serverTimingStart))
        if (!serverTiming[serverTimingLabel] || Number(serverTiming[serverTimingLabel]) < dur) {
          serverTiming[serverTimingLabel] = `${dur}`
        }

        // Forward server timings
        const serverTimingsHeader = path<string>(['response', 'headers', 'server-timing'], ctx)
        if (!ctx.cacheHit && !ctx.inflightHit && !ctx.memoizedHit && serverTimingsHeader) {
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
