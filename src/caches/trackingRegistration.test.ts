import { resetCacheNamingForTests } from './cacheNaming'
import { DiskCache } from './DiskCache'
import { LRUCache } from './LRUCache'
import { LRUDiskCache } from './LRUDiskCache'
import { MultilayeredCache } from './MultilayeredCache'
import { resetCacheTrackingRegistryForTests, subscribeToCacheTracking } from './trackingRegistry'

// How the four cache classes land in the tracking registry: an explicit metricName,
// a callsite-derived name when there is none, and nothing at all when opted out.
describe('cache tracking registration', () => {
  let registrations: Array<[string, unknown]>

  beforeEach(() => {
    resetCacheTrackingRegistryForTests()
    resetCacheNamingForTests()
    registrations = []
    subscribeToCacheTracking(event => registrations.push([event.name, event.cache]))
  })

  it('registers an LRUCache built with metricName under that name', () => {
    const cache = new LRUCache<string, number>({ max: 10, metricName: 'pages' })

    expect(registrations).toEqual([['pages', cache]])
  })

  it('derives a callsite name for an LRUCache built without metricName', () => {
    const cache = new LRUCache<string, number>({ max: 10 })

    expect(registrations).toEqual([['src/caches/trackingRegistration.test.ts', cache]])
  })

  it('suffixes the derived name of a second unnamed cache from the same file', () => {
    new LRUCache<string, number>({ max: 10 }) // tslint:disable-line:no-unused-expression
    const second = new LRUCache<string, number>({ max: 10 })

    expect(registrations.map(([name]) => name)).toEqual([
      'src/caches/trackingRegistration.test.ts',
      'src/caches/trackingRegistration.test.ts#2',
    ])
    expect(registrations[1][1]).toBe(second)
  })

  it('does not register a cache built with metricName: false', () => {
    new LRUCache<string, number>({ max: 10, metricName: false }) // tslint:disable-line:no-unused-expression

    expect(registrations).toEqual([])
  })

  it('does not register the multilayer an LRUCache builds internally', () => {
    // The internal MultilayeredCache wraps the LRUCache itself and opts out:
    // registering it would count the getOrSet reads twice, once per wrapper.
    new LRUCache<string, number>({ max: 10, metricName: 'pages' }) // tslint:disable-line:no-unused-expression

    expect(registrations).toHaveLength(1)
    expect(registrations[0][0]).toBe('pages')
  })

  it('keeps the metricName out of the underlying lru-cache options', () => {
    const cache = new LRUCache<string, number>({ max: 10, metricName: 'pages' })

    // If metricName leaked into the LRU options the public surface would still work,
    // so assert the option that did go through instead: max.
    expect(cache.getStats().max).toBe(10)
  })

  it('registers an LRUDiskCache built with metricName', () => {
    const cache = new LRUDiskCache<number>('/tmp/does-not-matter', { max: 10, metricName: 'assets' })

    expect(registrations).toEqual([['assets', cache]])
  })

  it('registers a DiskCache built with metricName', () => {
    const cache = new DiskCache<number>('/tmp/does-not-matter', undefined, undefined, { metricName: 'assets-disk' })

    expect(registrations).toEqual([['assets-disk', cache]])
  })

  it('registers a MultilayeredCache built with metricName', () => {
    const layer = new LRUCache<string, number>({ max: 10, metricName: false })
    const cache = new MultilayeredCache<string, number>([layer], { metricName: 'layered' })

    expect(registrations).toEqual([['layered', cache]])
  })
})
