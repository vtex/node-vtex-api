import { MiddlewareContext } from '../context'
import { cacheKey, CacheType, isCacheable } from './cache'

export type Memoized = Required<Pick<MiddlewareContext, 'cacheHit' | 'response'>>

interface MemoizationOptions {
  memoizedCache: Map<string, Promise<Memoized>>
}

export const memoizationMiddleware = ({memoizedCache}: MemoizationOptions) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isCacheable(ctx.config, CacheType.Any) || !ctx.config.memoizable) {
      return await next()
    }

    const key = cacheKey(ctx.config)
    const isMemoized = memoizedCache.has(key) ? 1 : 0
    ctx.cacheHit = {
      inflight: isMemoized,
    }

    if (isMemoized) {
      const memoized = await memoizedCache.get(key)!
      ctx.cacheHit = {
        ...memoized.cacheHit,
        memoized: 1,
      }
      ctx.response = memoized.response
      return
    } else {
      const promise = new Promise<Memoized>(async (resolve, reject) => {
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
      memoizedCache.set(key, promise)
      await promise
    }
  }
}
