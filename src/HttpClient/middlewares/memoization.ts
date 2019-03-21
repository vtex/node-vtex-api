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

    if (memoizedCache.has(key)) {
      const memoized = await memoizedCache.get(key)!
      ctx.cacheHit = {
        memoized: true,
        memory: false,
        revalidated: false,
        router: false,
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
