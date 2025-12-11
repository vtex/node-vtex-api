import Semaphore from 'semaphore-async-await'
import TokenBucket from 'tokenbucket'
import { ForbiddenError, TooManyRequestsError } from '../../../../../errors'
import { ServiceContext } from '../../typings'
import { createTokenBucket } from '../../utils/tokenBucket'
import { concurrentRateLimiter, perMinuteRateLimiter } from './rateLimit'

const nopCtx: ServiceContext = {} as ServiceContext
const nopNext = async () => { return }
const mutexNext = (mutex: Semaphore) => () => mutex.wait()
const throwNext = () => { throw new ForbiddenError('Default message')}
type Middleware = (ctx: ServiceContext, next: () => Promise<any>) => Promise<void>

async function execRequests(requestsAmount: number, middleware: Middleware) {
  await Promise.all(
    new Array(requestsAmount).fill(null).map(_ => middleware(nopCtx, nopNext))
  )
}

function startRequest(middleware: Middleware, customNext?: () => Promise<void>) {
  const mutex: Semaphore = new Semaphore(0)
  const middlewarePromise = middleware(nopCtx, customNext ?? mutexNext(mutex))
  return { mutex, middlewarePromise }
}

function getRequestsArray(
  requestsAmount: number,
  middleware: Middleware,
  customNext?: () => Promise<void>
): { mutexArr: Semaphore[], promisesArr: Promise<void>[] } {
  const results = new Array(requestsAmount).fill(null).map(_ => startRequest(middleware, customNext))
  return { 
    mutexArr: results.map(result => result.mutex), 
    promisesArr: results.map(result => result.middlewarePromise),
  }
}

describe('Rate limit per minute', () => {

  test('Test per minute middleware', async () => {
    // 2 * 1000 because bucket size is / 2 in order to not overflow amount of requests in 1 minute
    const globalLimiter: TokenBucket | undefined = createTokenBucket(2 * 1000)
    const perMinuteRateLimiterMiddleware = perMinuteRateLimiter(2 * 400, globalLimiter)

    await expect(
      execRequests(300, perMinuteRateLimiterMiddleware)
    ).resolves.not.toThrowError(TooManyRequestsError)

    await expect(
      execRequests(300, perMinuteRateLimiterMiddleware)
    ).rejects.toThrowError(TooManyRequestsError)
  })

  test('Test global per minute middleware with short limit', async () => {
    const globalLimiter: TokenBucket | undefined = createTokenBucket(2 * 500)
    const perMinuteRateLimiterMiddlewareRoute = perMinuteRateLimiter(2 * 1000, globalLimiter)
    const perMinuteRateLimiterMiddlewareEvent = perMinuteRateLimiter(2 * 1000, globalLimiter)

    await expect(
      Promise.all([
        execRequests(300, perMinuteRateLimiterMiddlewareRoute),
        execRequests(300, perMinuteRateLimiterMiddlewareEvent),
      ])
    ).rejects.toThrowError(TooManyRequestsError)
  })

  test('Test global per minute middleware with large limit', async () => {
    const globalLimiter: TokenBucket | undefined = createTokenBucket(2 * 10000)
    const perMinuteRateLimiterMiddlewareRoute = perMinuteRateLimiter(2 * 2500, globalLimiter)
    const perMinuteRateLimiterMiddlewareEvent = perMinuteRateLimiter(2 * 2500, globalLimiter)

    await expect(
      Promise.all([
        execRequests(2000, perMinuteRateLimiterMiddlewareRoute),
        execRequests(2000, perMinuteRateLimiterMiddlewareEvent),
      ])
    ).resolves.not.toThrowError(TooManyRequestsError)

  })

})

describe('Rate limit concurrent', () => {
  test('Test concurrent middleware not throw 429', async () => {
    const concurrentLimiterMiddleware = concurrentRateLimiter(5)

    const firstHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware)
    firstHalfRequests.mutexArr.forEach(mutex => mutex.signal())

    await expect(
      Promise.all(firstHalfRequests.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)

    const secondHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware)
    secondHalfRequests.mutexArr.forEach(mutex => mutex.signal())

    await expect(
      Promise.all(secondHalfRequests.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)
  })

  test('Test concurrent middleware throw 429', async () => {
    const concurrentLimiterMiddleware = concurrentRateLimiter(5)
    const firstPart = getRequestsArray(5, concurrentLimiterMiddleware)
    const secondPart = getRequestsArray(5, concurrentLimiterMiddleware, throwNext)
    
    await expect(
      Promise.all(secondPart.promisesArr)
    ).rejects.toThrowError(TooManyRequestsError)

    firstPart.mutexArr.forEach(mutex => mutex.signal())

    await expect(
      Promise.all(firstPart.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)
    
    const thirdPart = getRequestsArray(5, concurrentLimiterMiddleware)
    thirdPart.mutexArr.forEach(mutex => mutex.signal())

    await expect(
      Promise.all(thirdPart.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)
  })

  test('Test concurrent middleware throw error != 429', async () => {
    const concurrentLimiterMiddleware = concurrentRateLimiter(5)

    const firstHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware, throwNext)
    firstHalfRequests.mutexArr.forEach(mutex => mutex.signal())

    await expect(
      Promise.all(firstHalfRequests.promisesArr)
    ).rejects.toThrowError(ForbiddenError)

    const secondHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware, throwNext)
    secondHalfRequests.mutexArr.forEach(mutex => mutex.signal())

    await expect(
      Promise.all(secondHalfRequests.promisesArr)
    ).rejects.not.toThrowError(TooManyRequestsError)
  })
})
