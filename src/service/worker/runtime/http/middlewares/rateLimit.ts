import TokenBucket from 'tokenbucket'
import { TooManyRequestsError } from '../../../../../errors'
import { ServiceContext } from '../../typings'
import { createTokenBucket } from '../../utils/tokenBucket'

const responseMessageConcurrent = 'Rate Exceeded: Too many requests in execution'
const responseMessagePerMinute = 'Rate Exceeded: Too many requests'

function noopMiddleware(_: ServiceContext, next: () => Promise<void>) {
  return next()
}

export function perMinuteRateLimiter(rateLimit?: number, globalRateLimitBucketPerMinute?: TokenBucket) {
  if (!rateLimit && !globalRateLimitBucketPerMinute) {
    return noopMiddleware
  }

  const tokenBucket: TokenBucket = createTokenBucket(rateLimit, globalRateLimitBucketPerMinute)

  return function perMinuteRateMiddleware(ctx: ServiceContext, next: () => Promise<void>) {
    if (!tokenBucket.removeTokensSync(1)) {
      throw new TooManyRequestsError(responseMessagePerMinute)
    }
    return next()
  } 
}

export function concurrentRateLimiter(rateLimit?: number) {
  if (!rateLimit) {
    return noopMiddleware
  }
  let reqsInExecution = 0
  const maxRequests = rateLimit
  return async function concurrentRateMiddleware(ctx: ServiceContext, next: () => Promise<void>) {
    if (reqsInExecution > maxRequests) {
      throw new TooManyRequestsError(responseMessageConcurrent)
    }
    reqsInExecution++
    try {
      await next()
    } finally {
      reqsInExecution--
    }
  } 
}