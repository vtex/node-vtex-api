import { ComposedMiddleware } from 'koa-compose'
import { forEach, keys, reduce } from 'ramda'

import { IOClients } from '../clients/IOClients'
import { MetricsAccumulator } from '../metrics/metricsAccumulator'
import { ServiceContext } from '../service/typings'

export const hrToMillis = ([seconds, nanoseconds]: [number, number]) =>
  Math.round((seconds * 1e3) + (nanoseconds / 1e6))

export const hrToNano = ([seconds, nanoseconds]: [number, number]) =>
  seconds * 1e9 + nanoseconds

export const formatNano = (nanoseconds: number): string =>
  `${(nanoseconds / 1e9).toFixed(0)}s ${((nanoseconds / 1e6) % 1e3).toFixed(0)}ms`

export const reduceHrToNano =
  reduce((acc: number, hr: [number, number]) => acc + hrToNano(hr), 0 as number)

function recordTimings(start: [number, number], name: string, ctx: ServiceContext) {
  // Capture the total amount of time spent in this middleware
  const end = process.hrtime(start)
  ctx.timings[name] = end
  metrics.batch(name, end)

  // This middleware has added it's own metrics
  // Just add them to `timings` scoped by the middleware's name and batch them
  const middlewareMetricsKeys: string[] = keys(ctx.metrics) as string[]
  if (middlewareMetricsKeys.length > 0) {
    forEach((k: string) => {
      const metricEnd = ctx.metrics[k]
      const metricName = `${name}-${k}`
      ctx.timings[metricName] = metricEnd
      metrics.batch(metricName, metricEnd)
    }, middlewareMetricsKeys)
  }
}

export function timer<T extends IOClients>(middleware: ComposedMiddleware<ServiceContext<T>>): ComposedMiddleware<ServiceContext<T>> {
  return async (ctx: ServiceContext<T>, next: (() => Promise<any>) | undefined) => {
    if (!ctx.timings) {
      ctx.timings = {}
    }
    if (!ctx.metrics) {
      ctx.metrics = {}
    }
    const start = process.hrtime()
    try {
      await middleware(ctx, async () => {
        recordTimings(start, middleware.name, ctx)
        ctx.metrics = {}
        if (next) {
          await next()
        }
      })
    } catch (e) {
      recordTimings(start, middleware.name, ctx)
      throw e
    }
  }
}

declare global {
  const metrics: MetricsAccumulator

  namespace NodeJS {
    interface Global {
      metrics: MetricsAccumulator
    }
  }
}
