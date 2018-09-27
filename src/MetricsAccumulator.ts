import {filter, flatten, map, mapObjIndexed, values} from 'ramda'
import {mean, median, percentile} from 'stats-lite'

import {hrToMillis} from './utils/Time'

interface Metric {
  name: string
  [key: string]: number | boolean | string | undefined
}

interface AggregateMetric {
  count: number
  max: number
  mean: number
  median: number
  min: number
  percentile95: number
  percentile99: number
}

interface EnrichedAggregateMetric extends Metric, AggregateMetric {
  production: boolean
}

interface GetStats {
  getStats(): {
    [key: string]: number | boolean | string | undefined
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
  // Metrics from production workspaces
  private metricsMillis: Record<string, number[]> = {}
  // Metrics from development workspaces
  private devMetricsMillis: Record<string, number[]> = {}
  // Tracked cache instances
  private cacheMap: Record<string, GetStats>
  
  private onFlushMetrics: Array<() => Metric | Metric[]>
  
  constructor() {
    this.onFlushMetrics = []
    this.cacheMap = {}
    this.resetAccumulators()
  }

  public batchHrTimeMetricFromEnd = (name: string, end: [number, number], production: boolean) => {
    this.batchMetric(name, hrToMillis(end), production)
  }

  public batchHrTimeMetric = (name: string, start: [number, number], production: boolean) => {
    this.batchMetric(name, hrToMillis(process.hrtime(start)), production)
  }

  public batchMetric = (name: string, timeMillis: number, production: boolean) => {
    if (production) {
      if (!this.metricsMillis[name]) {
        this.metricsMillis[name] = []
      }
      this.metricsMillis[name].push(timeMillis)
    } else {
      if (!this.devMetricsMillis[name]) {
        this.devMetricsMillis[name] = []
      }
      this.devMetricsMillis[name].push(timeMillis)
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

  protected createMetricToAggregateReducer = (production: boolean) => (value: any, key: string, obj: any): EnrichedAggregateMetric => { //must be protected in order to override
    const metricToAggregateReducer: EnrichedAggregateMetric = {
      name: key,
      production,
      ...this.aggregate(value),
    }
    return metricToAggregateReducer
  }
  
  protected aggregate = (value: number[]): AggregateMetric => ({
    count: value.length, // tslint:disable-line:object-literal-sort-keys
    max: Math.max(...value),
    mean: mean(value),
    median: median(value),
    min: Math.min(...value),
    percentile95: percentile(value, 0.95),
    percentile99: percentile(value, 0.99),
  })

  protected resetAccumulators = () => {
    this.metricsMillis = {}
    this.devMetricsMillis = {}
  }

  protected getAggregateMetrics = (): Metric[] => {
    const removeIrrelevantMetrics = (metrics: EnrichedAggregateMetric[]): Metric[] => 
      filter(metric => metric.max > 10, metrics)

    const aggregateMetricsAll: EnrichedAggregateMetric[] = values(mapObjIndexed(
      this.createMetricToAggregateReducer(true),
      this.metricsMillis,
    ))
    const aggregateMetrics = removeIrrelevantMetrics(aggregateMetricsAll)

    const aggregateDevMetricsAll: EnrichedAggregateMetric[] = values(mapObjIndexed(
      this.createMetricToAggregateReducer(false),
      this.devMetricsMillis,
    ))
    const aggregateDevMetrics = removeIrrelevantMetrics(aggregateDevMetricsAll)

    return [...aggregateMetrics, ...aggregateDevMetrics]
  }

  protected flushMetrics = (): Metric[] => {      // must it be protected in order to override

    const systemMetrics: Metric[] = [
      {
        name: 'cpu',
        ...cpuUsage(),
      },
      {
        name: 'memory',
        ...process.memoryUsage(),
      }
    ]

    const onFlushMetrics = flatten(map(getMetric => getMetric(), this.onFlushMetrics))

    const cacheMetrics = values(mapObjIndexed(
      this.cacheToMetric,
      this.cacheMap,
    ))

    this.resetAccumulators()

    return [...systemMetrics, ...this.getAggregateMetrics(), ...onFlushMetrics, ...cacheMetrics]
  }

  private cacheToMetric = (value: GetStats, key: string): Metric => ({
    name: `${key}-cache`,
    ...value.getStats(),
  })
}
