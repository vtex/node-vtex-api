import { isType } from 'graphql'
import TokenBucket from 'tokenbucket'
import { TooManyRequestsError } from '../../../../../errors/TooManyRequestsError'
import { ServiceContext } from '../../typings'
import { createTokenBucket } from '../../utils/tokenBucket'
import { perMinuteRateLimiter } from './rateLimit'

const nopCtx: ServiceContext = {} as ServiceContext
const nopNext = async () => { return }

async function execRequests(requestsAmount: number, middleware: any) {
  for (let i = 0; i < requestsAmount; i++){
    await middleware(nopCtx, nopNext)
  }
}

describe('rateLimitPerMinute', () => {

  test('Test event per minute middleware', async () => {
    // 2 * 1000 because bucket size is / 2 in order to not overflow amount of requests in 1 minute
    const globalRateLimitBucketPerMinute: TokenBucket | undefined = createTokenBucket(2 * 1000)
    const perMinuteRateLimiterMiddlewareEvent = perMinuteRateLimiter(2 * 400, globalRateLimitBucketPerMinute)
    
    await expect(
      execRequests(300, perMinuteRateLimiterMiddlewareEvent)
    ).resolves.not.toThrowError(TooManyRequestsError)
    
    await expect(
      execRequests(300, perMinuteRateLimiterMiddlewareEvent)
    ).rejects.toThrowError(TooManyRequestsError)
  })


  test('Test route per minute middleware', async () => {
    const globalRateLimitBucketPerMinute: TokenBucket | undefined = createTokenBucket(2000)
    const perMinuteRateLimiterMiddlewareRoute = perMinuteRateLimiter(2 * 400, globalRateLimitBucketPerMinute)
    
    await expect(
      execRequests(300, perMinuteRateLimiterMiddlewareRoute)
    ).resolves.not.toThrowError(TooManyRequestsError)
    
    await expect(
      execRequests(600, perMinuteRateLimiterMiddlewareRoute)
    ).rejects.toThrowError(TooManyRequestsError)
  })

  test('Test global per minute middleware with short limit', async () => {
    const globalRateLimitBucketPerMinute: TokenBucket | undefined = createTokenBucket(2 * 500)
    const perMinuteRateLimiterMiddlewareRoute = perMinuteRateLimiter(2 * 1000, globalRateLimitBucketPerMinute)
    const perMinuteRateLimiterMiddlewareEvent = perMinuteRateLimiter(2 * 1000, globalRateLimitBucketPerMinute)

    await expect(
      Promise.all([
        execRequests(600, perMinuteRateLimiterMiddlewareRoute),
        execRequests(600, perMinuteRateLimiterMiddlewareEvent),
      ])
    ).rejects.toThrowError(TooManyRequestsError)
  })

  test('Test global per minute middleware with large limit', async () => {
    const globalRateLimitBucketPerMinute: TokenBucket | undefined = createTokenBucket(2 * 10000)
    const perMinuteRateLimiterMiddlewareRoute = perMinuteRateLimiter(2 * 2500, globalRateLimitBucketPerMinute)
    const perMinuteRateLimiterMiddlewareEvent = perMinuteRateLimiter(2 * 2500, globalRateLimitBucketPerMinute)
    
    await expect(
      Promise.all([
        execRequests(2000, perMinuteRateLimiterMiddlewareRoute),
        execRequests(2000, perMinuteRateLimiterMiddlewareEvent),
      ])
    ).resolves.not.toThrowError(TooManyRequestsError)

  })
  
})
