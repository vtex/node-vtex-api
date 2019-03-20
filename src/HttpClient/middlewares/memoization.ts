import { MiddlewareContext } from '../context'
import { cacheKey } from './cache'

export type Memoized = Promise<Required<Pick<MiddlewareContext, 'cacheHit' | 'response'>>>

interface MemoizationOptions {
  memoizedCache: Map<string, Memoized>
}

export const memoizationMiddleware = ({memoizedCache}: MemoizationOptions) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    const key = cacheKey(ctx.config)

    if (memoizedCache.has(key)) {
      const memoized = await memoizedCache.get(key)!
      ctx.cacheHit = memoized.cacheHit
      ctx.response = memoized.response
    } else {
      memoizedCache.set(key, new Promise(async (resolve, reject) => {
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
      }))
    }
  }
}
