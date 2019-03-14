import { assoc, flatten, map, mapObjIndexed, values } from 'ramda'
import { mean, median, percentile } from 'stats-lite'

import { CacheHit } from '../HttpClient/context'
import { hrToMillis } from '../utils/Time'

export interface Metric {
  name: string
  [key: string]: number | string | null,
}

interface NamedMetric {
  name: string,
  [key: string]: string | number | boolean | null
}

interface EnvMetric extends NamedMetric {
  production: boolean,
}

// Production pods never handle development workspaces and vice-versa.
const production: boolean = process.env.VTEX_PRODUCTION === 'true'

interface CacheHitMap {
  disk: number | null
  memory: number | null
  revalidated: number | null
  router: number | null
}

interface Aggregate {
  count: number
  mean: number
  median: number
  percentile95: number
  percentile99: number
  max: number
}

const CACHE_HIT_TYPES: Array<keyof CacheHit> = ['disk', 'memory', 'router', 'revalidated']

type AggregateMetric = EnvMetric & CacheHitMap & Aggregate

interface GetStats {
  getStats(): {
    [key: string]: number | boolean | string | undefined,
  }
}

let lastCpu: NodeJS.CpuUsage = process.cpuUsage()

function cpuUsage () {
  const diff = process.cpuUsage(lastCpu)
  lastCpu = {
    system: lastCpu.system + diff.system,
    user: lastCpu.user + diff.user,
  }
  return diff
}

export class MetricsAccumulator {
  private metricsMillis: Record<string, number[]>
  private cacheHits: Record<string, CacheHitMap>
  // Tracked cache instances
  private cacheMap: Record<string, GetStats>

  private onFlushMetrics: Array<() => Metric | Metric[]>

  constructor() {
    this.metricsMillis = {}
    this.cacheHits = {}
    this.onFlushMetrics = []
    this.cacheMap = {}
  }

  /**
   * @deprecated in favor of MetricsAccumulator.batch(name, diffNs, cacheHit)
   * @see batch
   */
  public batchHrTimeMetricFromEnd = (name: string, end: [number, number]) => {
    this.batchMetric(name, hrToMillis(end))
  }

  /**
   * @deprecated in favor of MetricsAccumulator.batch(name, diffNs, cacheHit)
   * @see batch
   */
  public batchHrTimeMetric = (name: string, start: [number, number]) => {
    this.batchMetric(name, hrToMillis(process.hrtime(start)))
  }

  public batchMetric = (name: string, timeMillis: number) => {
    if (!this.metricsMillis[name]) {
      this.metricsMillis[name] = []
    }
    this.metricsMillis[name].push(timeMillis)
  }

  /**
   * Batches a named metric which took `diffNs`.
   *
   * @param name Metric label.
   * @param diffNs The result of calling process.hrtime() passing a previous process.hrtime() value.
   * @param cacheHit If this metric should be cached, an object indicating the nature of the cache hit, or false to indicate a miss.
   *
   * @see https://nodejs.org/api/process.html#process_process_hrtime_time
   */
  public batch = (name: string, diffNs: [number, number], cacheHit?: CacheHit | false) => {
    this.batchMetric(name, hrToMillis(diffNs))
    if (cacheHit || cacheHit === false) {
      if (!this.cacheHits[name]) {
        this.cacheHits[name] = { disk: 0, memory: 0, router: 0, revalidated: 0 }
      }

      if (cacheHit) {
        for (const type of CACHE_HIT_TYPES) {
          if (cacheHit[type]) {
            this.cacheHits[name][type]!++
          }
        }
      }
    }
  }

  public addOnFlushMetric = (metricFn: () => Metric | Metric[]) => {
    this.onFlushMetrics.push(metricFn)
  }

  public trackCache = (name: string, cacheInstance: GetStats) => {
    this.cacheMap[name] = cacheInstance
  }

  public statusTrack = () => {
    return this.flushMetrics()
  }

  private metricToAggregate = (value: any, key: string): AggregateMetric => {
    const aggregate: AggregateMetric = {
      name: key,
      count: value.length, // tslint:disable-line:object-literal-sort-keys
      max: Math.max(...value),
      mean: mean(value),
      median: median(value),
      percentile95: percentile(value, 0.95),
      percentile99: percentile(value, 0.99),
      production,
      disk: this.cacheHits[key] ? this.cacheHits[key].disk : null,
      memory: this.cacheHits[key] ? this.cacheHits[key].memory : null,
      revalidated: this.cacheHits[key] ? this.cacheHits[key].revalidated : null,
      router: this.cacheHits[key] ? this.cacheHits[key].router : null,
    }
    delete this.metricsMillis[key]
    delete this.cacheHits[key]
    return aggregate
  }

  private cacheToMetric = (value: GetStats, key: string): EnvMetric => ({
    ...value.getStats(),
    name: `${key}-cache`,
    production,
  })

  private flushMetrics = (): EnvMetric[] => {
    const aggregateMetrics: EnvMetric[] = values(mapObjIndexed(
      this.metricToAggregate,
      this.metricsMillis,
    ))

    const systemMetrics: EnvMetric[] = [
      {
        ...cpuUsage(),
        name: 'cpu',
        production,
      },
      {
        ...process.memoryUsage(),
        name: 'memory',
        production,
      },
    ]

    const onFlushMetrics = flatten(map(getMetric => getMetric(), this.onFlushMetrics)) as NamedMetric[]
    const envFlushMetric = map(assoc('production', production), onFlushMetrics) as EnvMetric[]

    const cacheMetrics = values(mapObjIndexed(
      this.cacheToMetric,
      this.cacheMap,
    ))

    return [...systemMetrics, ...aggregateMetrics, ...envFlushMetric, ...cacheMetrics]
  }
}
