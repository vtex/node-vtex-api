import {flatten, map, mapObjIndexed, values} from 'ramda'
import {mean, median, percentile} from 'stats-lite'

import {hrToMillis} from './utils/Time'

export interface Metric {
  name: string
  [key: string]: any
}

export interface AggregateStats {
  count: number
  max: number
  mean: number
  median: number
  min: number
  percentile95: number
  percentile99: number
}

export interface AggregateMetric extends Metric, AggregateStats {}

interface GetStats {
  getStats(): {
    [key: string]: number | boolean | string | undefined
  }
}

export class MetricsAccumulator {
  private static lastCpu: NodeJS.CpuUsage = process.cpuUsage()
  
  protected onFlushMetrics: Array<() => Metric | Metric[]>

  // Metrics from production workspaces
  private metricsMillis: Record<string, number[]> = {}
  // Metrics from development workspaces
  private devMetricsMillis: Record<string, number[]> = {}
  // Tracked cache instances
  private cacheMap: Record<string, GetStats>
  
  private metricToAggregate: (value: any, key: string, obj: any) => AggregateMetric
  private devMetricToAggregate: (value: any, key: string, obj: any) => AggregateMetric
  
  constructor() {
    this.onFlushMetrics = []
    this.cacheMap = {}
    this.resetAccumulators()
    this.metricToAggregate = this.createMetricToAggregateReducer(true)
    this.devMetricToAggregate = this.createMetricToAggregateReducer(false)
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

  protected aggregate = (value: number[]): AggregateStats => ({
    count: value.length, // tslint:disable-line:object-literal-sort-keys
    max: Math.max(...value),
    mean: mean(value),
    median: median(value),
    min: Math.min(...value),
    percentile95: percentile(value, 0.95),
    percentile99: percentile(value, 0.99),
  })

  protected getAggregateMetrics = (): Metric[] => {
    const aggregateMetricsAll: AggregateMetric[] = values(mapObjIndexed(
      this.metricToAggregate,
      this.metricsMillis,
    ))
    const aggregateMetrics = aggregateMetricsAll

    const aggregateDevMetricsAll: AggregateMetric[] = values(mapObjIndexed(
      this.devMetricToAggregate,
      this.devMetricsMillis,
    ))
    const aggregateDevMetrics = aggregateDevMetricsAll

    return [...aggregateMetrics, ...aggregateDevMetrics]
  }

  protected cpuUsage () {
    const diff = process.cpuUsage(MetricsAccumulator.lastCpu)
    MetricsAccumulator.lastCpu = {
      system: MetricsAccumulator.lastCpu.system + diff.system,
      user: MetricsAccumulator.lastCpu.user + diff.user,
    }
    return diff
  }

  // Avoiding arrow function: the traditional syntax works better with overriding.
  protected createMetricToAggregateReducer(production: boolean): (value: any, key: string, obj: any) => AggregateMetric {
    const metricToAggregateReducer = (value: any, key: string, obj: any): AggregateMetric => {
      const aggregateMetric: AggregateMetric = {
        name: key,
        production,
        ...this.aggregate(value),
      }
      return aggregateMetric
    }
    return metricToAggregateReducer
  }
  
  protected resetAccumulators() {
    this.metricsMillis = {}
    this.devMetricsMillis = {}
  }

  protected flushMetrics(): Metric[] {

    const systemMetrics: Metric[] = [
      {
        name: 'cpu',
        ...this.cpuUsage(),
      },
      {
        name: 'memory',
        ...process.memoryUsage(),
      }
    ]

    const onFlushMetrics = flatten(map(getMetric => getMetric(), this.onFlushMetrics)) as Metric[]

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
