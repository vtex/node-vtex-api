import { stringify } from 'qs'
import { InflightKeyGenerator, MiddlewareContext, RequestConfig } from '../typings'

export type Inflight = Required<Pick<MiddlewareContext, 'cacheHit' | 'response'>>

const inflight = new Map<string, Promise<Inflight>>()
let metricsAdded = false

export const singleFlightMiddleware = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const { inflightKey } = ctx.config

  if (!inflightKey) {
    return await next()
  }

  // We cannot allow single flight requests to
  // cancel any request
  ctx.config.cancelToken = undefined

  // global.metrics is only initialized by startApp() in the IO service
  // runtime. Standalone consumers of HttpClient (e.g. the toolbelt CLI)
  // run without it, so guard the bare global reference.
  if (!metricsAdded && typeof metrics !== 'undefined') {
    metrics.addOnFlushMetric(() => ({
      name: 'node-vtex-api-inflight-map-size',
      size: inflight.size,
    }))
    metricsAdded = true
  }

  const key = inflightKey(ctx.config)
  const isInflight = !!inflight.has(key)

  if (isInflight) {
    const memoized = await inflight.get(key)!
    ctx.inflightHit = isInflight
    ctx.response = memoized.response
    return
  } else {
    const promise = new Promise<Inflight>(async (resolve, reject) => {
      try {
        await next()
        resolve({
          cacheHit: ctx.cacheHit!,
          response: ctx.response!,
        })
      } catch (err) {
        reject(err)
      } finally {
        inflight.delete(key)
      }
    })
    inflight.set(key, promise)
    await promise
  }
}

export const inflightURL: InflightKeyGenerator = ({ baseURL, url }: RequestConfig) => baseURL! + url!

export const inflightUrlWithQuery: InflightKeyGenerator = ({ baseURL, url, params }: RequestConfig) =>
  baseURL! + url! + stringify(params, { arrayFormat: 'repeat', addQueryPrefix: true })
