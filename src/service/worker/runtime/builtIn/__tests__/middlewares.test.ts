import { register } from 'prom-client'

import * as clusterMetricsAggregator from '../../../../metrics/clusterMetricsAggregator'
import { prometheusLoggerMiddleware } from '../middlewares'

const buildCtx = (path: string, headers: Record<string, string> = {}) => {
  const setHeaders: Record<string, string> = {}
  return {
    body: undefined as any,
    get: (key: string) => headers[key] ?? '',
    request: { path },
    set: (key: string, value: string) => {
      setHeaders[key] = value
    },
    setHeaders,
    status: undefined as any,
  }
}

describe('prometheusLoggerMiddleware', () => {
  beforeEach(() => {
    // collectDefaultMetrics() and the lag measurer register into the default
    // registry on every middleware construction; clear it between cases.
    register.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // AC3: workers=1 (LINKED) serves the default registry content unchanged.
  it('serves the local default registry in single-worker mode without IPC', async () => {
    const sendSpy = jest.fn()
    ;(process as any).send = sendSpy
    const aggSpy = jest.spyOn(clusterMetricsAggregator, 'requestAggregatedMetrics')
    const localMetricsSpy = jest.spyOn(register, 'metrics').mockResolvedValue('LOCAL_REGISTRY')

    const middleware = prometheusLoggerMiddleware(1)
    const ctx: any = buildCtx('/metrics')
    const next = jest.fn()

    await middleware(ctx, next)

    expect(localMetricsSpy).toHaveBeenCalledTimes(1)
    expect(ctx.body).toBe('LOCAL_REGISTRY')
    expect(ctx.status).toBe(200)
    expect(ctx.setHeaders['Content-Type']).toBe(register.contentType)
    expect(aggSpy).not.toHaveBeenCalled()
    expect(sendSpy).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()

    delete (process as any).send
  })

  // AC4: default process metrics are present in the single-worker output.
  it('includes default process metrics in single-worker output', async () => {
    const middleware = prometheusLoggerMiddleware(1)
    const ctx: any = buildCtx('/metrics')
    await middleware(ctx, () => Promise.resolve())
    expect(ctx.body).toContain('process_cpu_seconds_total')
  })

  it('requests the cluster aggregate in multi-worker mode', async () => {
    const aggSpy = jest
      .spyOn(clusterMetricsAggregator, 'requestAggregatedMetrics')
      .mockResolvedValue('AGGREGATED')

    const middleware = prometheusLoggerMiddleware(4)
    const ctx: any = buildCtx('/metrics')

    await middleware(ctx, () => Promise.resolve())

    expect(aggSpy).toHaveBeenCalledTimes(1)
    expect(ctx.body).toBe('AGGREGATED')
    expect(ctx.status).toBe(200)
    expect(ctx.setHeaders['Content-Type']).toBe(register.contentType)
  })

  it('does not count /metrics scrapes and passes through other routes', async () => {
    const aggSpy = jest.spyOn(clusterMetricsAggregator, 'requestAggregatedMetrics')
    const middleware = prometheusLoggerMiddleware(4)

    const nonMetricsCtx: any = buildCtx('/some-route')
    const next1 = jest.fn().mockResolvedValue(undefined)
    await middleware(nonMetricsCtx, next1)
    expect(next1).toHaveBeenCalledTimes(1)
    expect(nonMetricsCtx.body).toBeUndefined()

    // Requests carrying a colossus route id must pass through, not be answered.
    const routedCtx: any = buildCtx('/metrics', { 'x-colossus-route-id': 'my-route' })
    const next2 = jest.fn().mockResolvedValue(undefined)
    await middleware(routedCtx, next2)
    expect(next2).toHaveBeenCalledTimes(1)
    expect(routedCtx.body).toBeUndefined()

    expect(aggSpy).not.toHaveBeenCalled()
  })
})
