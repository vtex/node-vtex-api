import {
  CacheTrackingEvent,
  registerCacheForTracking,
  resetCacheTrackingRegistryForTests,
  subscribeToCacheTracking,
} from './trackingRegistry'

const fakeCache = () => ({ getCumulativeStats: () => ({ hits: 0, total: 0 }) })

const namesOf = (events: CacheTrackingEvent[]) => events.map(event => event.name)

describe('cacheTrackingRegistry', () => {
  let events: CacheTrackingEvent[]

  beforeEach(() => {
    resetCacheTrackingRegistryForTests()
    events = []
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const subscribe = () => subscribeToCacheTracking(event => events.push(event))

  it('drains entries registered before the subscription, then reports later ones', () => {
    const early = fakeCache()
    registerCacheForTracking('early', early)

    subscribe()

    const late = fakeCache()
    registerCacheForTracking('late', late)

    expect(events.map(event => [event.name, event.cache])).toEqual([['early', early], ['late', late]])
  })

  it('supports independent subscribers, each with the full history', () => {
    registerCacheForTracking('pages', fakeCache())

    const first: string[] = []
    const second: string[] = []
    subscribeToCacheTracking(event => first.push(event.name))
    subscribeToCacheTracking(event => second.push(event.name))

    expect(first).toEqual(['pages'])
    expect(second).toEqual(['pages'])
  })

  it('stops notifying an unsubscribed listener', () => {
    const unsubscribe = subscribe()

    unsubscribe()
    registerCacheForTracking('pages', fakeCache())

    expect(events).toEqual([])
  })

  it('keeps a same-name re-registration of the same instance silent', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const cache = fakeCache()

    registerCacheForTracking('pages', cache)
    registerCacheForTracking('pages', cache)

    subscribe()

    expect(namesOf(events)).toEqual(['pages'])
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns and keeps the first name when one instance takes two explicit names', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const cache = fakeCache()

    registerCacheForTracking('pages', cache)
    registerCacheForTracking('pages-cache', cache)

    subscribe()

    expect(namesOf(events)).toEqual(['pages'])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("already registered as 'pages'"))
  })

  it('moves a repeated name to the new instance, with a warning, and frees the old one', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const first = fakeCache()
    const second = fakeCache()

    registerCacheForTracking('pages', first)
    registerCacheForTracking('pages', second)

    subscribe()

    expect(events.map(event => [event.name, event.cache])).toEqual([['pages', second]])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'pages' was already registered"))

    // The replaced instance may take another name; the new one may not.
    warnSpy.mockClear()
    registerCacheForTracking('assets', first)
    registerCacheForTracking('other', second)

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("already registered as 'pages'"))
  })

  it('keeps registering when a subscriber throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation()
    subscribeToCacheTracking(() => {
      throw new Error('subscriber boom')
    })

    subscribe()
    registerCacheForTracking('pages', fakeCache())

    expect(namesOf(events)).toEqual(['pages'])
    expect(errorSpy).toHaveBeenCalledWith(
      'cacheTrackingRegistry: a subscriber threw while registering cache',
      'pages',
      expect.any(Error)
    )
  })

  describe('name origins', () => {
    it('renames a callsite-named cache when a client name arrives, reporting previousName', () => {
      const cache = fakeCache()
      subscribe()

      registerCacheForTracking('node/index.js', cache, 'callsite')
      registerCacheForTracking('Apps', cache, 'client')

      expect(events.map(event => [event.name, event.previousName])).toEqual([
        ['node/index.js', undefined],
        ['Apps', 'node/index.js'],
      ])
    })

    it('renames a client-named cache when an explicit name arrives', () => {
      const cache = fakeCache()
      subscribe()

      registerCacheForTracking('Apps', cache, 'client')
      registerCacheForTracking('pages', cache, 'explicit')

      expect(namesOf(events)).toEqual(['Apps', 'pages'])
      expect(events[1].previousName).toBe('Apps')
    })

    it('lets a weaker origin never rename, silently', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const cache = fakeCache()
      subscribe()

      registerCacheForTracking('Apps', cache, 'client')
      registerCacheForTracking('node/index.js', cache, 'callsite')

      registerCacheForTracking('pages', cache, 'explicit')
      registerCacheForTracking('OtherClient', cache, 'client')

      expect(namesOf(events)).toEqual(['Apps', 'pages'])
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('never lets a derived name steal a name an explicit registration holds', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const explicit = fakeCache()
      const derived = fakeCache()

      registerCacheForTracking('Apps', explicit, 'explicit')
      registerCacheForTracking('Apps', derived, 'client')

      subscribe()

      expect(events.map(event => [event.name, event.cache])).toEqual([['Apps', explicit]])
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })
})
