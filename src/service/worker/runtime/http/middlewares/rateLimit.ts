import TokenBucket from 'tokenbucket'
import { TooManyRequestsError } from '../../../../../errors'
import { ServiceContext } from '../../typings'

const responseMessageConcurrent = 'Rate Exceeded: Too many requests in execution'
const responseMessagePerMinute = 'Rate Exceeded: Too many requests'

function noopMiddleware(_: ServiceContext, next: () => Promise<void>) {
  return next()
}

export function perMinuteRateLimiter(rateLimit?: number) {
  if (!rateLimit) {
    return noopMiddleware
  }

  const tokenBucket = new TokenBucket({
    interval: 'minute',
    size: Math.ceil(rateLimit / 2),
    spread: true,
    tokensToAddPerInterval: rateLimit,
  })
  return function perMinuteRateMiddleware(ctx: ServiceContext, next: () => Promise<void>) {
    if (!tokenBucket.removeTokensSync(1)) {
      throw new TooManyRequestsError(responseMessagePerMinute)
    }
    return next()
  } 
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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