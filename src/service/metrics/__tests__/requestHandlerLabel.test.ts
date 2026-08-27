import { EventEmitter } from 'events'
import { AggregatorRegistry, register } from 'prom-client'

import { requestHandlerLabel, UNNAMED_REQUEST_HANDLER } from '../requestHandlerLabel'
import { addRequestMetricsMiddleware } from '../requestMetricsMiddleware'

// Node's cluster IPC serializes messages as JSON, which drops properties whose
// value is `undefined`. This is what the master receives from each worker.
const overClusterIpc = <T>(payload: T): T => JSON.parse(JSON.stringify(payload))

const aggregatedMetrics = async (): Promise<string> => {
  const workerRegistryJson = overClusterIpc(await register.getMetricsAsJSON())
  return AggregatorRegistry.aggregate([workerRegistryJson]).metrics()
}

// Minimal ServiceContext stand-in for addRequestMetricsMiddleware: it only needs
// `req`/`res` emitters and a `response` with `length` and `status`.
const buildCtx = (requestHandlerName?: string) => {
  const res = new EventEmitter()
  return {
    req: new EventEmitter(),
    requestHandlerName,
    res,
    response: { length: 128, status: 200 },
  }
}

// Closing the response inside `next()` makes the middleware finish its timings
// synchronously, so no stream plumbing is needed.
const runRequest = async (middleware: any, ctx: any) => {
  await middleware(ctx, async () => {
    ctx.res.emit('close')
  })
}

const samplesOf = (text: string, metric: string) =>
  text
    .split('\n')
    .filter((line) => line.startsWith(metric) && !line.startsWith('# '))

describe('requestHandlerLabel', () => {
  it('falls back to "undefined" so the label is never empty or missing', () => {
    expect(UNNAMED_REQUEST_HANDLER).toBe('undefined')
    expect(requestHandlerLabel(undefined)).toBe(UNNAMED_REQUEST_HANDLER)
    expect(requestHandlerLabel('')).toBe(UNNAMED_REQUEST_HANDLER)
  })

  it('keeps a named handler untouched', () => {
    expect(requestHandlerLabel('private-handler:ssr')).toBe('private-handler:ssr')
  })
})

describe('addRequestMetricsMiddleware handler label', () => {
  beforeEach(() => {
    // The instruments register into the default registry on construction.
    register.clear()
  })

  it('labels requests that never reached a named handler', async () => {
    const middleware = addRequestMetricsMiddleware()
    await runRequest(middleware, buildCtx(undefined))

    const local = await register.metrics()
    expect(samplesOf(local, 'runtime_http_requests_total')).toEqual([
      'runtime_http_requests_total{handler="undefined",status_code="200"} 1',
    ])
  })

  // Regression: with `handler: undefined` the label key survived in-process but was
  // dropped by the cluster IPC JSON serialization, so the aggregated /metrics
  // exposed `runtime_http_requests_total{status_code="200"}` — a second, unnamed
  // series (Prometheus reads an absent label as `handler=""`).
  it('keeps the handler label through the cluster IPC round-trip', async () => {
    const middleware = addRequestMetricsMiddleware()
    await runRequest(middleware, buildCtx(undefined))

    const aggregated = await aggregatedMetrics()
    const samples = samplesOf(aggregated, 'runtime_http_requests_total')

    expect(samples).toEqual(['runtime_http_requests_total{handler="undefined",status_code="200"} 1'])
    expect(aggregated).not.toContain('runtime_http_requests_total{status_code=')
  })

  it('emits no sample with a missing or empty handler label', async () => {
    const middleware = addRequestMetricsMiddleware()
    await runRequest(middleware, buildCtx(undefined))
    await runRequest(middleware, buildCtx('private-handler:ssr'))

    const aggregated = await aggregatedMetrics()
    const handlerLabelledMetrics = [
      'runtime_http_requests_total',
      'runtime_http_requests_duration_milliseconds',
      'runtime_http_response_size_bytes',
    ]

    handlerLabelledMetrics.forEach((metric) => {
      samplesOf(aggregated, metric).forEach((sample) => {
        expect(sample).toMatch(/handler="[^"]+"/)
      })
    })
  })

  it('reports named and unnamed handlers as separate series', async () => {
    const middleware = addRequestMetricsMiddleware()
    await runRequest(middleware, buildCtx('private-handler:ssr'))
    await runRequest(middleware, buildCtx(undefined))

    const aggregated = await aggregatedMetrics()
    expect(samplesOf(aggregated, 'runtime_http_requests_total').sort()).toEqual([
      'runtime_http_requests_total{handler="private-handler:ssr",status_code="200"} 1',
      'runtime_http_requests_total{handler="undefined",status_code="200"} 1',
    ])
  })

  it('labels aborted requests that never reached a named handler', async () => {
    const middleware = addRequestMetricsMiddleware()
    const ctx: any = buildCtx(undefined)

    await middleware(ctx, async () => {
      ctx.req.emit('aborted')
      ctx.res.emit('close')
    })

    const aggregated = await aggregatedMetrics()
    expect(samplesOf(aggregated, 'runtime_http_aborted_requests_total')).toEqual([
      'runtime_http_aborted_requests_total{handler="undefined"} 1',
    ])
  })
})
