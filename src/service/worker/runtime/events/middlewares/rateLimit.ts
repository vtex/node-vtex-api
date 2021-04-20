import TokenBucket from 'tokenbucket'
import { TooManyRequestsError } from '../../../../../errors'
import { RateLimiter, ServiceContext } from '../../typings'

function noopMiddlewareFunc() {
  return async function noopMiddleware(_: ServiceContext, next: () => Promise<void>) {
    await next()
  } 
}

export function perMinuteRateLimiter(rateLimit: RateLimiter | undefined) {
  if (!rateLimit || !rateLimit.perMinute) {
    return noopMiddlewareFunc()
  }

  const tokenBucket = new TokenBucket({
    interval: 'minute',
    size: rateLimit.perMinute,
    spread: true,
    tokensToAddPerInterval: rateLimit.perMinute,
  })
  return async function perMinuteRateMiddleware(ctx: ServiceContext, next: () => Promise<void>) {
    console.log('* - Requests: ' + tokenBucket.tokensLeft.toString() + ' - ')
    if (!tokenBucket.removeTokensSync(1)) {
      throw new TooManyRequestsError()
    }
    await next()
  } 
}

export function concurrentRateLimiter(rateLimit: RateLimiter | undefined) {
  if (!rateLimit || !rateLimit.concurrent) {
    return noopMiddlewareFunc()
  }
  let totalRequests = 0
  const maxRequests = rateLimit.concurrent
  return async function concurrentRateMiddleware(ctx: ServiceContext, next: () => Promise<void>) {
    totalRequests++
    try {
      if (totalRequests > maxRequests) {
        throw new TooManyRequestsError()
      }
      await next()
    } finally {
      totalRequests--
    }
  } 
}