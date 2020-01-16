import { collectDefaultMetrics, Gauge, Registry } from 'prom-client'
import gcStats from 'prometheus-gc-stats'

import { USE_FAST_RECORDER } from '../../../../constants'
import { MetricsLogger } from '../../../logger/metricsLogger'
import { ServiceContext } from '../typings'
import { createSlowRecorder, Recorder } from '../utils/recorder'

export async function recorderMiddleware (ctx: ServiceContext, next: () => Promise<void>) {
  if (USE_FAST_RECORDER) {
    const recorder = new Recorder()
    ctx.state.recorder = recorder
    await next()
    recorder.flush(ctx)
  } else {
    ctx.state.recorder = createSlowRecorder(ctx)
    await next()
  }
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
  const register = new Registry()
  const gauge = new Gauge({ name: 'io_http_requests_current', help: 'The current number of requests in course.' })
  register.registerMetric(gauge)
  collectDefaultMetrics({ register })
  const startGcStats = gcStats(register)
  startGcStats()
  return async (ctx: ServiceContext, next: () => Promise<void>) => {
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
