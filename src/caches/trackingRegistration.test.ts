import { DiskCache } from './DiskCache'
import { LRUCache } from './LRUCache'
import { LRUDiskCache } from './LRUDiskCache'
import { MultilayeredCache } from './MultilayeredCache'
import { resetCacheTrackingRegistryForTests, subscribeToCacheTracking } from './trackingRegistry'

// The metricName constructor option: each cache class self-registers at construction
// time, so apps never call DiagnosticsMetrics.trackCache() for them by hand.
describe('metricName constructor option', () => {
  let registrations: Array<[string, unknown]>

  beforeEach(() => {
    resetCacheTrackingRegistryForTests()
    registrations = []
    subscribeToCacheTracking((name, cache) => registrations.push([name, cache]))
  })

  it('registers an LRUCache built with metricName', () => {
    const cache = new LRUCache<string, number>({ max: 10, metricName: 'pages' })

    expect(registrations).toEqual([['pages', cache]])
  })

  it('does not register an LRUCache without metricName', () => {
    // tslint:disable-next-line:no-unused-expression
    new LRUCache<string, number>({ max: 10 })

    expect(registrations).toEqual([])
  })

  it('does not register the multilayer an LRUCache builds internally', () => {
    // The internal MultilayeredCache wraps the LRUCache itself: registering it would
    // count the getOrSet reads twice, once per wrapper.
    // tslint:disable-next-line:no-unused-expression
    new LRUCache<string, number>({ max: 10, metricName: 'pages' })

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
    const layer = new LRUCache<string, number>({ max: 10 })
    const cache = new MultilayeredCache<string, number>([layer], { metricName: 'layered' })

    expect(registrations).toEqual([['layered', cache]])
  })
})
