import { resetCacheNamingForTests } from '../caches/cacheNaming'
import { LRUCache } from '../caches/LRUCache'
import {
  CacheTrackingEvent,
  resetCacheTrackingRegistryForTests,
  subscribeToCacheTracking,
} from '../caches/trackingRegistry'
import { HttpClient } from './HttpClient'

// The tier-2 naming rule: a cache passed as a client's memoryCache takes the
// client's name unless a stronger origin (an explicit metricName) already named it.
describe('HttpClient memoryCache tracking', () => {
  let events: CacheTrackingEvent[]

  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }

  const buildClient = (memoryCache: LRUCache<string, unknown>, name = 'Apps') =>
    new HttpClient({
      account: 'account',
      authToken: 'token',
      baseURL: 'http://localhost:80',
      logger,
      memoryCache,
      name,
    } as any)

  beforeEach(() => {
    resetCacheTrackingRegistryForTests()
    resetCacheNamingForTests()
    events = []
    subscribeToCacheTracking(event => events.push(event))
  })

  it('registers an unnamed memoryCache under the client name', () => {
    const cache = new LRUCache<string, unknown>({ max: 10 })

    buildClient(cache)

    const last = events[events.length - 1]
    expect(last.name).toBe('Apps')
    expect(last.source).toBe('client')
    expect(last.cache).toBe(cache)
  })

  it('renames the callsite-derived name the cache got at construction', () => {
    const cache = new LRUCache<string, unknown>({ max: 10 })

    buildClient(cache)

    // Constructed first (callsite event), wrapped second (client upgrade).
    expect(events.map(event => [event.name, event.previousName])).toEqual([
      ['src/HttpClient/HttpClientTracking.test.ts', undefined],
      ['Apps', 'src/HttpClient/HttpClientTracking.test.ts'],
    ])
  })

  it('keeps an explicit metricName instead of the client name', () => {
    // tslint:disable-next-line:no-unused-expression
    new LRUCache<string, unknown>({ max: 10, metricName: 'pages' })

    expect(events.map(event => event.name)).toEqual(['pages'])

    const cache = new LRUCache<string, unknown>({ max: 10, metricName: 'vbase' })
    buildClient(cache)

    expect(events.map(event => event.name)).toEqual(['pages', 'vbase'])
  })

  it('ignores a memoryCache that cannot report cumulative stats', () => {
    const notTrackable = { get: jest.fn(), has: jest.fn(), set: jest.fn() }

    // tslint:disable-next-line:no-unused-expression
    new HttpClient({
      account: 'account',
      authToken: 'token',
      baseURL: 'http://localhost:80',
      logger,
      memoryCache: notTrackable,
      name: 'Apps',
    } as any)

    expect(events).toEqual([])
  })

  it('registers a shared memoryCache once, under the first client that wraps it', () => {
    const shared = new LRUCache<string, unknown>({ max: 10 })

    buildClient(shared, 'Apps')
    buildClient(shared, 'LicenseManager')

    expect(events.map(event => event.name)).toEqual([
      'src/HttpClient/HttpClientTracking.test.ts',
      'Apps',
    ])
  })
})
