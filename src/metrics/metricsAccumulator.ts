import { flatten, map, mapObjIndexed, values } from 'ramda'
import { mean, median, percentile } from 'stats-lite'

import { hrToMillis } from '../utils/Time'

export interface Metric {
  name: string
  [key: string]: any
}

// Production pods never handle development workspaces and vice-versa.
const production = process.env.VTEX_PRODUCTION

interface AggregateMetric extends Metric {
  count: number
  mean: number
  median: number
  percentile95: number
  percentile99: number
  max: number
  hits: number
}

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
  private metricsCacheHits: Record<string, number>
  // Tracked cache instances
  private cacheMap: Record<string, GetStats>

  private onFlushMetrics: Array<() => Metric | Metric[]>

  constructor() {
    this.metricsMillis = {}
    this.metricsCacheHits = {}
    this.onFlushMetrics = []
    this.cacheMap = {}
  }

  /**
   * @deprecated in favor of MetricsAccumulator.batch(name, diffNs, isCacheHit)
   * @see batch
   */
  public batchHrTimeMetricFromEnd = (name: string, end: [number, number]) => {
    this.batchMetric(name, hrToMillis(end))
  }

  /**
   * @deprecated in favor of MetricsAccumulator.batch(name, diffNs, isCacheHit)
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
   * @param isCacheHit If this metric can be considered a cache hit.
   *
   * @see https://nodejs.org/api/process.html#process_process_hrtime_time
   */
  public batch = (name: string, diffNs: [number, number], isCacheHit?: boolean) => {
    this.batchMetric(name, hrToMillis(diffNs))
    if (isCacheHit) {
      this.metricsCacheHits[name] = this.metricsCacheHits[name] == null ? 1 : this.metricsCacheHits[name] + 1
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
      hits: this.metricsCacheHits[key],
    }
    delete this.metricsMillis[key]
    delete this.metricsCacheHits[key]
    return aggregate
  }

  private cacheToMetric = (value: GetStats, key: string): Metric => ({
    name: `${key}-cache`,
    ...value.getStats(),
  })

  private flushMetrics = (): Metric[] => {
    const aggregateMetrics: Metric[] = values(mapObjIndexed(
      this.metricToAggregate,
      this.metricsMillis,
    ))

    const systemMetrics: Metric[] = [
      {
        name: 'cpu',
        ...cpuUsage(),
      },
      {
        name: 'memory',
        ...process.memoryUsage(),
      },
    ]

    const onFlushMetrics = flatten(map(getMetric => getMetric(), this.onFlushMetrics)) as Metric[]

    const cacheMetrics = values(mapObjIndexed(
      this.cacheToMetric,
      this.cacheMap,
    ))

    return [...systemMetrics, ...aggregateMetrics, ...onFlushMetrics, ...cacheMetrics]
  }
}
