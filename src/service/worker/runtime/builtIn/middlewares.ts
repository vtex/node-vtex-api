import { collectDefaultMetrics, register } from 'prom-client'
import { HeaderKeys } from '../../../../constants'
import { MetricsLogger } from '../../../logger/metricsLogger'
import { EventLoopLagMeasurer } from '../../../tracing/metrics/measurers/EventLoopLagMeasurer'
import { ServiceContext } from '../typings'
import { Recorder } from '../utils/recorder'

export async function recorderMiddleware(ctx: ServiceContext, next: () => Promise<void>) {
  const recorder = new Recorder()
  ctx.state.recorder = recorder
  await next()
  recorder.flush(ctx)
  return
}

export const addMetricsLoggerMiddleware = () => {
  const metricsLogger = new MetricsLogger()
  return (ctx: ServiceContext, next: () => Promise<void>) => {
    ctx.metricsLogger = metricsLogger
    return next()
  }
}

export const prometheusLoggerMiddleware = () => {
  collectDefaultMetrics()
  const eventLoopLagMeasurer = new EventLoopLagMeasurer()
  eventLoopLagMeasurer.start()

  return async (ctx: ServiceContext, next: () => Promise<void>) => {
    if (ctx.request.path !== '/metrics') {
      return next()
    }

    const routeId = ctx.get(HeaderKeys.COLOSSUS_ROUTE_ID)
    if (routeId) {
      return next()
    }

    await eventLoopLagMeasurer.updateInstrumentsAndReset()
    ctx.set('Content-Type', register.contentType)
    ctx.body = await register.metrics()
    ctx.status = 200
  }
}
