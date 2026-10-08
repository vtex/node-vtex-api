import { DiskCache } from './DiskCache'
import { LRUCache } from './LRUCache'
import { LRUDiskCache } from './LRUDiskCache'
import { MultilayeredCache } from './MultilayeredCache'

// getStats() reports a per-window delta, consumed on read; getCumulativeStats() reports
// the process-lifetime total and never resets, so both readers can share a cache.
describe('cache stats: windowed getStats() vs cumulative getCumulativeStats()', () => {
  describe('LRUCache', () => {
    const primed = () => {
      const cache = new LRUCache<string, number>({ max: 10 })
      cache.set('a', 1)
      return cache
    }

    it('getStats() returns only what happened since the previous read', () => {
      const cache = primed()

      cache.get('a')
      cache.get('a')
      cache.get('absent')
      expect(pick(cache.getStats())).toEqual({ hits: 2, total: 3, hitRate: 2 / 3 })

      cache.get('a')
      cache.get('absent')
      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 2, hitRate: 0.5 })

      // nothing happened in between
      expect(pick(cache.getStats())).toEqual({ hits: 0, total: 0, hitRate: undefined })
    })

    it('getCumulativeStats() keeps growing across getStats() reads', () => {
      const cache = primed()

      cache.get('a')
      cache.get('absent')
      cache.getStats() // legacy flush consumes the window
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 1, total: 2 })

      cache.get('a')
      cache.getStats() // and again
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 2, total: 3 })
    })

    it('getCumulativeStats() is side-effect free: reading it twice reports the same thing', () => {
      const cache = primed()
      cache.get('a')

      expect(cache.getCumulativeStats()).toEqual(cache.getCumulativeStats())
      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 1, hitRate: 1 })
    })

    it('counts disposed items in both reads', () => {
      const cache = new LRUCache<string, number>({ max: 1 })
      cache.set('a', 1)
      cache.set('b', 2) // evicts 'a'

      expect(cache.getCumulativeStats().disposedItems).toBe(1)
      expect(cache.getStats().disposedItems).toBe(1)
      expect(cache.getStats().disposedItems).toBe(0) // window consumed
      expect(cache.getCumulativeStats().disposedItems).toBe(1) // total survives
    })

    it('exposes itemCount, length and max on both reads', () => {
      const cache = primed()

      expect(cache.getCumulativeStats()).toMatchObject({ itemCount: 1, length: 1, max: 10 })
      expect(cache.getStats()).toMatchObject({ itemCount: 1, length: 1, max: 10 })
    })
  })

  describe('DiskCache', () => {
    it('splits the window from the cumulative total', async () => {
      const readFile = jest.fn().mockResolvedValue({ value: 1 })
      const cache = new DiskCache<any>('/tmp/does-not-matter', readFile, jest.fn())

      await cache.get('a')
      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 1, hitRate: undefined })
      expect(cache.getCumulativeStats()).toEqual({ hits: 1, misses: 0, total: 1 })

      await cache.get('b')
      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 1, hitRate: undefined })
      expect(cache.getCumulativeStats()).toEqual({ hits: 2, misses: 0, total: 2 })
    })

    it('counts a failed read as a miss', async () => {
      const readFile = jest.fn().mockRejectedValue(new Error('not there'))
      const cache = new DiskCache<any>('/tmp/does-not-matter', readFile, jest.fn())

      await cache.get('a')

      expect(cache.getCumulativeStats()).toEqual({ hits: 0, misses: 1, total: 1 })
    })
  })

  describe('LRUDiskCache', () => {
    it('splits the window from the cumulative total', async () => {
      const readFile = jest.fn().mockResolvedValue({ value: 1 })
      const cache = new LRUDiskCache<any>('/tmp/does-not-matter', { max: 10 }, readFile, jest.fn())
      await cache.set('a', 1, 60000)

      await cache.get('a')
      await cache.get('absent')

      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 2, hitRate: 0.5 })
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 1, total: 2 })

      await cache.get('a')

      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 1, hitRate: 1 })
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 2, total: 3 })
    })
  })

  describe('MultilayeredCache', () => {
    it('splits the window from the cumulative total', async () => {
      const layer = new LRUCache<string, number>({ max: 10 })
      layer.set('a', 1)
      const cache = new MultilayeredCache<string, number>([layer])

      await cache.get('a')
      await cache.get('absent')

      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 2, hitRate: 0.5 })
      expect(cache.getCumulativeStats()).toEqual({ hits: 1, misses: 1, total: 2 })

      await cache.get('a')

      expect(pick(cache.getStats())).toEqual({ hits: 1, total: 1, hitRate: 1 })
      expect(cache.getCumulativeStats()).toEqual({ hits: 2, misses: 1, total: 3 })
    })
  })

  describe('miss accounting', () => {
    it('LRUCache counts a miss for a read that finds nothing', () => {
      const cache = new LRUCache<string, number>({ max: 10 })
      cache.set('a', 1)

      cache.get('absent')
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 0, misses: 1, total: 1 })

      cache.get('a')
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 1, misses: 1, total: 2 })
    })

    it('DiskCache does not count a read as a miss while it is still in flight', async () => {
      // The published miss count is monotonic only because it is counted at resolution:
      // deriving it from total - hits dips while a read is in flight, and the SDK reports a
      // dip on a monotonic counter as a reset.
      let release!: () => void
      const readFile = jest.fn(() => new Promise(resolve => { release = () => resolve({ value: 1 }) }))
      const cache = new DiskCache<any>('/tmp/does-not-matter', readFile as any, jest.fn())

      const inFlight = cache.get('a')
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 0, misses: 0, total: 1 })

      release()
      await inFlight
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 1, misses: 0, total: 1 })
    })

    it('LRUDiskCache counts each resolved miss once', async () => {
      const cache = new LRUDiskCache<any>('/tmp/does-not-matter', { max: 10 }, jest.fn(), jest.fn())

      await cache.get('absent')
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 0, misses: 1, total: 1 })

      await cache.get('absent')
      expect(cache.getCumulativeStats()).toMatchObject({ hits: 0, misses: 2, total: 2 })
    })

    it('MultilayeredCache counts one miss per lookup that finds nothing', async () => {
      const layer = new LRUCache<string, number>({ max: 10 })
      const cache = new MultilayeredCache<string, number>([layer])

      await cache.get('absent')

      expect(cache.getCumulativeStats()).toMatchObject({ hits: 0, misses: 1, total: 1 })
    })
  })
})

function pick(stats: { hits: number, total: number, hitRate?: number }) {
  return { hitRate: stats.hitRate, hits: stats.hits, total: stats.total }
}
