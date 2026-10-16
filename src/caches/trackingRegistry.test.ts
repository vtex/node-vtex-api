import {
  registerCacheForTracking,
  resetCacheTrackingRegistryForTests,
  subscribeToCacheTracking,
} from './trackingRegistry'

const fakeCache = () => ({ getCumulativeStats: () => ({ hits: 0, total: 0 }) })

describe('cacheTrackingRegistry', () => {
  beforeEach(() => {
    resetCacheTrackingRegistryForTests()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('drains entries registered before the subscription, then reports later ones', () => {
    const early = fakeCache()
    registerCacheForTracking('early', early)

    const seen: Array<[string, unknown]> = []
    subscribeToCacheTracking((name, cache) => seen.push([name, cache]))

    const late = fakeCache()
    registerCacheForTracking('late', late)

    expect(seen).toEqual([['early', early], ['late', late]])
  })

  it('supports independent subscribers, each with the full history', () => {
    registerCacheForTracking('pages', fakeCache())

    const first: string[] = []
    const second: string[] = []
    subscribeToCacheTracking(name => first.push(name))
    subscribeToCacheTracking(name => second.push(name))

    expect(first).toEqual(['pages'])
    expect(second).toEqual(['pages'])
  })

  it('stops notifying an unsubscribed listener', () => {
    const seen: string[] = []
    const unsubscribe = subscribeToCacheTracking(name => seen.push(name))

    unsubscribe()
    registerCacheForTracking('pages', fakeCache())

    expect(seen).toEqual([])
  })

  it('ignores a second registration of the same instance under another name, with a warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const cache = fakeCache()

    registerCacheForTracking('pages', cache)
    registerCacheForTracking('pages-cache', cache)

    const seen: string[] = []
    subscribeToCacheTracking(name => seen.push(name))

    expect(seen).toEqual(['pages'])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("already registered as 'pages'"))
  })

  it('keeps a same-name re-registration of the same instance silent', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const cache = fakeCache()

    registerCacheForTracking('pages', cache)
    registerCacheForTracking('pages', cache)

    const seen: string[] = []
    subscribeToCacheTracking(name => seen.push(name))

    expect(seen).toEqual(['pages'])
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('moves a repeated name to the new instance, with a warning, and frees the old one', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const first = fakeCache()
    const second = fakeCache()

    registerCacheForTracking('pages', first)
    registerCacheForTracking('pages', second)

    const seen: Array<[string, unknown]> = []
    subscribeToCacheTracking((name, cache) => seen.push([name, cache]))

    expect(seen).toEqual([['pages', second]])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'pages' was already registered"))

    // The replaced instance may take another name; the new one may not.
    warnSpy.mockClear()
    registerCacheForTracking('assets', first)
    registerCacheForTracking('other', second)

    const all: Array<[string, unknown]> = []
    subscribeToCacheTracking((name, cache) => all.push([name, cache]))

    expect(all).toEqual([['pages', second], ['assets', first]])
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("already registered as 'pages'"))
  })

  it('keeps registering when a subscriber throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation()
    subscribeToCacheTracking(() => {
      throw new Error('subscriber boom')
    })

    const seen: string[] = []
    subscribeToCacheTracking(name => seen.push(name))

    registerCacheForTracking('pages', fakeCache())

    expect(seen).toEqual(['pages'])
    expect(errorSpy).toHaveBeenCalledWith(
      'cacheTrackingRegistry: a subscriber threw while registering cache',
      'pages',
      expect.any(Error)
    )
  })
})
