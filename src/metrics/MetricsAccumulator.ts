import { assoc, flatten, map, mapObjIndexed, values } from 'ramda'
import { mean, median, percentile } from 'stats-lite'

import { httpAgentStats } from '../HttpClient/middlewares/request'
import { incomingRequestStats } from '../service/http/middlewares/requestStats'
import { hrToMillis } from '../utils/time'

export interface Metric {
  name: string
  [key: string]: number | string | null,
}

interface NamedMetric {
  name: string,
  [key: string]: any
}

export interface EnvMetric extends NamedMetric {
  production: boolean,
}

// Production pods never handle development workspaces and vice-versa.
const production: boolean = process.env.VTEX_PRODUCTION === 'true'

interface Aggregate {
  count: number
  mean: number
  median: number
  percentile95: number
  percentile99: number
  max: number
}

type AggregateMetric = EnvMetric & Aggregate

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

function getIncomingRequestStats () {
  const stats = incomingRequestStats.get()
  incomingRequestStats.clear()
  return stats
}

export type StatusTrack = () => EnvMetric[]

export class MetricsAccumulator {
  private metricsMillis: Record<string, number[]>
  private extensions: Record<string, Record<string, string | number>>
  // Tracked cache instances
  private cacheMap: Record<string, GetStats>

  private onFlushMetrics: Array<() => Metric | Metric[]>

  constructor() {
    this.metricsMillis = {}
    this.extensions = {}
    this.onFlushMetrics = []
    this.cacheMap = {}
  }

  public batchMetric = (name: string, timeMillis?: number, extensions?: Record<string, string | number>) => {
    if (!this.metricsMillis[name]) {
      this.metricsMillis[name] = []
    }

    if (timeMillis != null) {
      this.metricsMillis[name].push(timeMillis)
    }

    if (extensions) {
      if (!this.extensions[name]) {
        this.extensions[name] = {}
      }

      for (const [key, value] of Object.entries(extensions)) {
        const existing = this.extensions[name][key]
        if (typeof value === 'string' || typeof existing === 'string') {
          this.extensions[name][key] = value
        } else if (typeof value === 'number') {
          this.extensions[name][key] = (existing || 0) + value
        }
      }
    }
  }

  /**
   * Batches a named metric which took `diffNs`.
   *
   * @param name Metric label.
   * @param diffNs The result of calling process.hrtime() passing a previous process.hrtime() value.
   * @param extensions Any other relevant properties of this metric.
   *
   * @see https://nodejs.org/api/process.html#process_process_hrtime_time
   */
  public batch = (name: string, diffNs?: [number, number], extensions?: Record<string, string | number>) => {
    this.batchMetric(name, diffNs ? hrToMillis(diffNs) : undefined, extensions)
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
      ...this.extensions[key],
    }
    delete this.metricsMillis[key]
    delete this.extensions[key]
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
      this.metricsMillis
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
      {
        ...httpAgentStats(),
        name: 'httpAgent',
        production,
      },
      {
        ...getIncomingRequestStats(),
        name: 'incomingRequest',
        production,
      },
    ]

    const onFlushMetrics = flatten(map(getMetric => getMetric(), this.onFlushMetrics)) as NamedMetric[]
    const envFlushMetric = map(assoc('production', production), onFlushMetrics) as EnvMetric[]

    const cacheMetrics = values(mapObjIndexed(
      this.cacheToMetric,
      this.cacheMap
    ))

    return [...systemMetrics, ...aggregateMetrics, ...envFlushMetric, ...cacheMetrics]
  }
}
