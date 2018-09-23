import {flatten, map, mapObjIndexed, values} from 'ramda'
import * as stats from 'stats-lite'

import {hrToMillis} from './Time'

interface MetricsMap {
  [name: string]: number[]
}

interface Metric {
  name: string
  [key: string]: any
}

interface AggregateMetric extends Metric {
  count: number
  mean: number
  median: number
  percentile95: number
  percentile99: number
  max: number
  production: boolean
}

export interface GetStats {
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

export default class MetricsAggregator {
  // Metrics from production workspaces
  private metricsMillis: MetricsMap
  // Metrics from development workspaces
  private devMetricsMillis: MetricsMap

  private onFlushMeters: Array<() => Metric | Metric[]>

  constructor() {
    this.metricsMillis = {}
    this.devMetricsMillis = {}
    this.onFlushMeters = []
  }

  public batchHrTimeMetricFromEnd = (name: string, end: [number, number], production: boolean) => {
    this.batchMetric(name, hrToMillis(end), production)
  }

  public batchHrTimeMetric = (name: string, start, production: boolean) => {
    this.batchMetric(name, hrToMillis(process.hrtime(start)), production)
  }

  public batchMetric = (name, timeMillis, production: boolean) => {
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

  public addOnFlushMeter = (meter: () => Metric | Metric[]) => {
    this.onFlushMeters.push(meter)
  }

  public statusTrack = () => {
    return this.flushMetrics()
  }

  private metricToAggregate = (production: boolean) => (value, key, obj): AggregateMetric => {
    const aggregate: AggregateMetric = {
      name: key,
      count: value.length, // tslint:disable-line:object-literal-sort-keys
      max: Math.max(...value),
      mean: stats.mean(value),
      median: stats.median(value),
      percentile95: stats.percentile(value, 0.95),
      percentile99: stats.percentile(value, 0.99),
      production,
    }
    delete obj[key]
    return aggregate
  }

  private flushMetrics = (): Metric[] => {
    const aggregateMetrics: Metric[] = values(mapObjIndexed(
      this.metricToAggregate(true),
      this.metricsMillis,
    ))

    const aggregateDevMetrics: Metric[] = values(mapObjIndexed(
      this.metricToAggregate(false),
      this.devMetricsMillis,
    ))

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

    const onFlushMetrics = flatten(map(getMetric => getMetric(), this.onFlushMeters))

    return [...systemMetrics, ...aggregateMetrics, ...aggregateDevMetrics, ...onFlushMetrics]
  }
}


