import { collectDefaultMetrics, register } from 'prom-client'

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

    ctx.tracing?.currentSpan.setOperationName('builtin:prometheus-metrics')
    await eventLoopLagMeasurer.updateInstrumentsAndReset()
    ctx.set('Content-Type', register.contentType)
    ctx.body = register.metrics()
    ctx.status = 200
  }
}
