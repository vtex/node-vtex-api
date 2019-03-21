import { InflightKeyGenerator, MiddlewareContext, RequestConfig } from '../context'

export type Inflight = Required<Pick<MiddlewareContext, 'cacheHit' | 'response'>>

const inflight = new Map<string, Promise<Inflight>>()

export const singleFlightMiddleware = async (ctx: MiddlewareContext, next: () => Promise<void>) => {
  const { inflightKey } = ctx.config

  if (!inflightKey) {
    return await next()
  }

  const key = inflightKey(ctx.config)

  if (inflight.has(key)) {
    const memoized = await inflight.get(key)!
    ctx.cacheHit = {
      inflight: true,
      memoized: false,
      memory: false,
      revalidated: false,
      router: false,
    }
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
      }
      catch (err) {
        reject(err)
      }
    })
    inflight.set(key, promise)
    await promise
  }
}

export const inflightURL: InflightKeyGenerator = ({url}: RequestConfig) => url!
