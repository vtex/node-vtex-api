import { HttpLogEvents } from '../../tracing/LogEvents'
import { HttpCacheLogFields } from '../../tracing/LogFields'
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

    const span = ctx.tracing?.rootSpan

    const key = cacheKey(ctx.config)
    const isMemoized = !!memoizedCache.has(key)

    span?.log({ event: HttpLogEvents.CACHE_KEY_CREATE, [HttpCacheLogFields.CACHE_TYPE]: 'memoization', [HttpCacheLogFields.KEY]: key })

    if (isMemoized) {
      span?.setTag(CustomHttpTags.HTTP_MEMOIZATION_CACHE_RESULT, CacheResult.HIT)
      const memoized = await memoizedCache.get(key)!
      ctx.memoizedHit = isMemoized
      ctx.response = memoized.response
      return
    } else {
      span?.setTag(CustomHttpTags.HTTP_MEMOIZATION_CACHE_RESULT, CacheResult.MISS)
      const promise = new Promise<Memoized>(async (resolve, reject) => {
        try {
          await next()
          resolve({
            cacheHit: ctx.cacheHit!,
            response: ctx.response!,
          })

          span?.log({ event: HttpLogEvents.MEMOIZATION_CACHE_SAVED, [HttpCacheLogFields.KEY_SET]: key })
        } catch (err) {
          reject(err)
          span?.log({ event: HttpLogEvents.MEMOIZATION_CACHE_SAVED_ERROR, [HttpCacheLogFields.KEY_SET]: key })
        }
      })
      memoizedCache.set(key, promise)
      await promise
    }
  }
}
