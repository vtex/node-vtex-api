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

async function execRequests(requestsAmount: number, middleware: (ctx: ServiceContext, next: () => Promise<void>) => Promise<void>) {
  for (let i = 0; i < requestsAmount; i++) {
    await middleware(nopCtx, nopNext)
  }
}

function startRequest(middleware: (ctx: ServiceContext, next: () => Promise<any>) => Promise<void>, customNext?: () => Promise<void>) {
  const mutex: Semaphore = new Semaphore(0)
  const middlewarePromise = middleware(nopCtx, customNext ? customNext : mutexNext(mutex))
  return { mutex, middlewarePromise }
}

function getRequestsArray(
  requestsAmount: number,
  middleware: (ctx: ServiceContext, next: () => Promise<void>) => Promise<void>,
  customNext?: () => Promise<void>
): { mutexArr: Semaphore[], promisesArr: Array<Promise<void>> } {
  const mutexArr: Semaphore[] = []
  const promisesArr: Array<Promise<void>> = []
  
  for (let i = 0; i < requestsAmount; i++) {
    const request = startRequest(middleware, customNext)
    mutexArr.push(request.mutex)
    promisesArr.push(request.middlewarePromise)
  }
  
  return { mutexArr, promisesArr }
}

describe('Rate limit per minute', () => {

  test('Test per minute middleware', async () => {
    // 2 * 1000 because bucket size is / 2 in order to not overflow amount of requests in 1 minute
    const globalRateLimitBucketPerMinute: TokenBucket | undefined = createTokenBucket(2 * 1000)
    const perMinuteRateLimiterMiddleware = perMinuteRateLimiter(2 * 400, globalRateLimitBucketPerMinute)

    await expect(
      execRequests(300, perMinuteRateLimiterMiddleware)
    ).resolves.not.toThrowError(TooManyRequestsError)

    await expect(
      execRequests(300, perMinuteRateLimiterMiddleware)
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

describe('Rate limit concurrent', () => {
  test('Test concurrent middleware not throw 429', async () => {
    const concurrentLimiterMiddleware = concurrentRateLimiter(5)

    const firstHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware)
    for (let i = 0; i < 5; i++) {
      firstHalfRequests.mutexArr[i].signal()
    }

    await expect(
      Promise.all(firstHalfRequests.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)

    const secondHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware)
    for (let i = 0; i < 5; i++) {
      secondHalfRequests.mutexArr[i].signal()
    }

    await expect(
      Promise.all(secondHalfRequests.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)
  })

  test('Test concurrent middleware throw 429', async () => {
    const concurrentLimiterMiddleware = concurrentRateLimiter(5)
    const firstPart = getRequestsArray(5, concurrentLimiterMiddleware)
    const secondPart = getRequestsArray(5, concurrentLimiterMiddleware)

    for (let i = 0; i < 5; i++) {
      firstPart.mutexArr[i].signal()
    }

    await expect(
      Promise.all(firstPart.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)

    for (let i = 0; i < 5; i++) {
      secondPart.mutexArr[i].signal()
    }

    await expect(
      Promise.all(secondPart.promisesArr)
    ).rejects.toThrowError(TooManyRequestsError)

    const thirdPart = getRequestsArray(5, concurrentLimiterMiddleware)
    for (let i = 0; i < 5; i++) {
      thirdPart.mutexArr[i].signal()
    }

    await expect(
      Promise.all(thirdPart.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)
  })

  test('Test concurrent middleware throw error != 429', async () => {
    const concurrentLimiterMiddleware = concurrentRateLimiter(5)

    const firstHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware, throwNext)
    for (let i = 0; i < 5; i++) {
      firstHalfRequests.mutexArr[i].signal()
    }

    await expect(
      Promise.all(firstHalfRequests.promisesArr)
    ).rejects.toThrowError(ForbiddenError)

    const secondHalfRequests = getRequestsArray(5, concurrentLimiterMiddleware)
    for (let i = 0; i < 5; i++) {
      secondHalfRequests.mutexArr[i].signal()
    }

    await expect(
      Promise.all(secondHalfRequests.promisesArr)
    ).resolves.not.toThrowError(TooManyRequestsError)
  })
})
