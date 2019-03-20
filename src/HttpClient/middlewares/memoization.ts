import { MiddlewareContext } from '../context'
import { cacheKey, CacheType, isCacheable } from './cache'

export type Memoized = Required<Pick<MiddlewareContext, 'cacheHit' | 'response'>>

interface MemoizationOptions {
  memoizedCache: Map<string, Promise<Memoized>>
  type: CacheType
}

export const memoizationMiddleware = ({type, memoizedCache}: MemoizationOptions) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isCacheable(ctx.config, type)) {
      return await next()
    }

    const key = cacheKey(ctx.config)

    if (memoizedCache.has(key)) {
      const memoized = await memoizedCache.get(key)!
      console.log('memoizedCacheHIT')
      ctx.cacheHit = memoized.cacheHit
      ctx.response = memoized.response
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
      console.log('memoizedCacheMISS')
      memoizedCache.set(key, promise)
      await promise
    }
  }
}
