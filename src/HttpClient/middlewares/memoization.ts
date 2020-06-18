import { HttpLogEvents } from '../../tracing/LogEvents'
import { CustomHttpTags } from '../../tracing/Tags'
import { MiddlewareContext } from '../typings'
import { cacheKey, CacheResult, CacheType, isLocallyCacheable } from './cache'

export type Memoized = Required<Pick<MiddlewareContext, 'cacheHit' | 'response'>>

interface MemoizationOptions {
  memoizedCache: Map<string, Promise<Memoized>>
}

export const memoizationMiddleware = ({ memoizedCache }: MemoizationOptions) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isLocallyCacheable(ctx.config, CacheType.Any) || !ctx.config.memoizable) {
      return next()
    }

    const span = ctx.tracing!.rootSpan
    const key = cacheKey(ctx.config)
    const isMemoized = !!memoizedCache.has(key)
    span.log({ event: HttpLogEvents.CACHE_KEY_CREATE, cacheType: 'memoization', key })

    if (isMemoized) {
      span.setTag(CustomHttpTags.HTTP_MEMOIZATION_CACHE_RESULT, CacheResult.HIT)
      const memoized = await memoizedCache.get(key)!
      ctx.memoizedHit = isMemoized
      ctx.response = memoized.response
      return
    } else {
      span.setTag(CustomHttpTags.HTTP_MEMOIZATION_CACHE_RESULT, CacheResult.MISS)
      const promise = new Promise<Memoized>(async (resolve, reject) => {
        try {
          await next()
          resolve({
            cacheHit: ctx.cacheHit!,
            response: ctx.response!,
          })
          span.log({ event: HttpLogEvents.MEMOIZATION_CACHE_SAVED, key })
        } catch (err) {
          reject(err)
          span.log({ event: HttpLogEvents.MEMOIZATION_CACHE_SAVED_ERROR, key })
        }
      })
      memoizedCache.set(key, promise)
      span.log({ event: HttpLogEvents.MEMOIZATION_STATS, keys: memoizedCache.size })
      await promise
    }
  }
}
