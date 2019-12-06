import Koa from 'koa'
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client'
import gcStats from 'prometheus-gc-stats'

import { MetricsLogger } from '../../logger/metricsLogger'
import { ServiceJSON, ServiceRuntimeContext } from './typings'
import { createRecorder } from './utils/recorder'

export function recorderMiddleware (ctx: Koa.Context, next: () => Promise<any>) {
  ctx.state.recorder = createRecorder(ctx)
  return next()
}

export const whoAmIHandler = ({
  events,
  routes,
}: ServiceJSON) => (ctx: ServiceRuntimeContext) => {
  ctx.response.status = 200
  ctx.response.body = {
    events,
    routes,
  }
  ctx.response.set('Cache-Control', 'public, max-age=86400') // cache for 24 hours
}

export const healthcheckHandler = ({
  events,
  routes,
}: ServiceJSON) => (ctx: ServiceRuntimeContext) => {
  ctx.response.status = 200
  ctx.response.body = {
    events,
    routes,
  }
}

export const metricsLoggerHandler = (ctx: ServiceRuntimeContext) => {
  ctx.response.status = 200
  ctx.response.body = ctx.metricsLogger.getSummaries()
}

export const addMetricsLoggerMiddleware = () => {
  const metricsLogger = new MetricsLogger()
  return (ctx: ServiceRuntimeContext, next: () => Promise<any>) => {
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
  return async (ctx: ServiceRuntimeContext, next: () => Promise<any>) => {
    if (ctx.request.path !== '/metrics') {
      gauge.inc(1)
      await next()
      gauge.dec(1)
      return
    }
    ctx.response.set('Content-Type', register.contentType)
    ctx.response.body = register.metrics()
    ctx.response.status = 200
  }
}
