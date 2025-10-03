import { compose, forEach, path, reduce, replace, split } from 'ramda'

import { RequestCancelledError } from '../../errors/RequestCancelledError'
import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import {
  cancelMessage,
} from '../../service/worker/runtime/http/middlewares/requestStats'
import {
  formatTimingName,
  hrToMillis,
  shrinkTimings,
} from '../../utils'
import { TIMEOUT_CODE } from '../../utils/retry'
import { statusLabel } from '../../utils/status'
import { MiddlewareContext } from '../typings'
import { Attributes } from '@opentelemetry/api'

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
        console.log(`VERBOSE: ${name}.${ctx.config.label}`, `start`)
      }

      await next()
      if (ctx.config.metric && ctx.response && ctx.response.status) {
        status = statusLabel(ctx.response.status)
      }
    } catch (err: any) {
      const isCancelled = (err.message === cancelMessage)
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
        }
        else if (isCancelled) {
          status = 'cancelled'
        } else {
          status = 'error'
        }
      }

      throw isCancelled
        ? new RequestCancelledError(err.message)
        : err
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

        if (ctx.config.retryCount) {
          const retryCount = ctx.config.retryCount

          if (retryCount > 0) {
            extensions[`retry-${status}-${retryCount}`] = 1
          }
        }

        const end = status === 'success' && !ctx.cacheHit && !ctx.inflightHit && !ctx.memoizedHit
          ? process.hrtime(start)
          : undefined

        // Legacy metrics (backward compatibility)
        metrics.batch(label, end, extensions)

        // New diagnostics metrics with stable names and attributes
        if (global.diagnosticsMetrics) {
          const elapsed = process.hrtime(start)
          const rawStatusCode = ctx.response?.status || errorStatus
          const baseAttributes: Attributes = {
            component: 'http-client',
            client_metric: ctx.config.metric,
            status_code: rawStatusCode,
            status,
          }

          // Record latency histogram with all context
          global.diagnosticsMetrics.recordLatency(elapsed, {
            ...baseAttributes,
          })

          // Increment counters for different event types (replaces extensions behavior)
          // Main request counter with status as attribute
          global.diagnosticsMetrics.incrementCounter('http_client_requests_total', 1, baseAttributes)
        } else {
          console.warn('DiagnosticsMetrics not available. HTTP client metrics not reported.')
        }

        if (ctx.config.verbose) {
          console.log(`VERBOSE: ${name}.${ctx.config.label}`, {
            ...extensions,
            ...errorCode || errorStatus ? {errorCode, errorStatus} : null,
            millis: end
              ? hrToMillis(end)
              : extensions.revalidated || extensions.router || status !== 'success'
                ? hrToMillis(process.hrtime(start))
                : '(from cache)',
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
      }
    }
  }
}
