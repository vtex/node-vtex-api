import Koa from 'koa'
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client'
import gcStats from 'prometheus-gc-stats'

import { MetricsLogger } from '../../logger/metricsLogger'
import { ServiceContext, ServiceJSON, ServiceRuntimeContext } from './typings'
import { createRecorder } from './utils/recorder'

export function recorderMiddleware (ctx: Koa.Context, next: () => Promise<void>) {
  ctx.state.recorder = createRecorder(ctx)
  return next()
}

export const whoAmIHandler = ({
  events,
  routes,
}: ServiceJSON) => (ctx: ServiceContext) => {
  ctx.status = 200
  ctx.body = {
    events,
    routes,
  }
  ctx.set('Cache-Control', 'public, max-age=86400') // cache for 24 hours
}

export const healthcheckHandler = ({
  events,
  routes,
}: ServiceJSON) => (ctx: ServiceContext) => {
  ctx.status = 200
  ctx.body = {
    events,
    routes,
  }
}

export const metricsLoggerHandler = (ctx: ServiceRuntimeContext) => {
  ctx.status = 200
  ctx.body = ctx.metricsLogger.getSummaries()
}

export const addMetricsLoggerMiddleware = () => {
  const metricsLogger = new MetricsLogger()
  return (ctx: ServiceRuntimeContext, next: () => Promise<void>) => {
    ctx.metricsLogger = metricsLogger
    return next()
  }
}

export const prometheusLoggerMiddleware = () => {
  const register = new Registry()
  const gauge = new Gauge({ name: 'io_http_requests_current', help: 'The current number of requests in course.' })
  register.registerMetric(gauge)
  collectDefaultMetrics({ register })
  const startGcStats = gcStats(register)
  startGcStats()
  return async (ctx: ServiceRuntimeContext, next: () => Promise<void>) => {
    if (ctx.request.path !== '/metrics') {
      gauge.inc(1)
      await next()
      gauge.dec(1)
      return
    }
    ctx.set('Content-Type', register.contentType)
    ctx.body = register.metrics()
    ctx.status = 200
  }
}
