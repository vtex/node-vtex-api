import { TooManyRequestsError } from "../../../../../errors";
import { RateLimiter, ServiceContext } from "../../typings";
const TokenBucket = require('tokenbucket');

function noopMiddleware() {
  return async function noopMiddleware(_: ServiceContext, next: () => Promise<void>) {
    await next();
  } 
}

export function perMinuteRateLimiter(rateLimit: RateLimiter | undefined) {
  if(!rateLimit || !rateLimit.perMinute) return noopMiddleware()

  var tokenBucket = new TokenBucket({
    size: rateLimit.perMinute, // a decidir, talvez isso ou limit mesmo, ou maybe até menos
    tokensToAddPerInterval: rateLimit.perMinute,
    interval: 'minute',
    spread: true,
  });
  return async function perMinuteRateLimiter(ctx: ServiceContext, next: () => Promise<void>) {
    console.log("* - Requests: " + tokenBucket.tokensLeft.toString() + " - ")
    if (!tokenBucket.removeTokensSync(1)) {
      throw new TooManyRequestsError();
    }
    await next();
  } 
}

export function concurrentRateLimiter(rateLimit: RateLimiter | undefined) {
  if(!rateLimit || !rateLimit.concurrent) return noopMiddleware()
  var totalRequests = 0
  var maxRequests = rateLimit.concurrent
  return async function concurrentRateLimiter(ctx: ServiceContext, next: () => Promise<void>) {
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