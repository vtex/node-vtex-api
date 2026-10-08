/**
 * Counters with a windowed read. `windowed()` reports the delta since the previous read and
 * `cumulative()` the process-lifetime total, so a windowed reader (the legacy flush) and a
 * cumulative one (the observable reader) can share a cache without consuming each other's
 * counts. Shared by the four cache classes so a fix to the delta/rollover behaviour cannot
 * land in one and be forgotten in the others.
 *
 * Misses are counted when a read resolves, never when it starts. The observable reader
 * publishes them as a monotonic counter, so a value derived from `total - hits` would dip
 * while a read is in flight — and the SDK reports a dip on a monotonic counter as a reset,
 * publishing the whole running total as one cycle's delta.
 */
export class WindowedCounters {
  private hits = 0
  private misses = 0
  private total = 0
  private disposed = 0
  private reported = { disposed: 0, hits: 0, misses: 0, total: 0 }

  public countHit = (): void => { this.hits += 1 }

  public countMiss = (): void => { this.misses += 1 }

  public countRead = (): void => { this.total += 1 }

  public countDisposed = (): void => { this.disposed += 1 }

  public windowed = () => {
    const window = {
      disposed: this.disposed - this.reported.disposed,
      hits: this.hits - this.reported.hits,
      misses: this.misses - this.reported.misses,
      total: this.total - this.reported.total,
    }

    this.reported = { disposed: this.disposed, hits: this.hits, misses: this.misses, total: this.total }
    return window
  }

  public cumulative = () => ({
    disposed: this.disposed,
    hits: this.hits,
    misses: this.misses,
    total: this.total,
  })
}
