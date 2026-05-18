import stringify from 'fast-json-stable-stringify'
import { compose, isNil, mapObjIndexed, reject, values } from 'ramda'
import { median, percentile, sum } from 'stats-lite'

import { PRODUCTION } from '../../constants'
import {
  cpuSnapshot,
  Snapshot,
  snapshotDiff,
} from '../worker/runtime/utils/diff'

const runtimeBaseDefaultMetricNames = ['routeStats']
const runtimeNodeDefaultMetricNames = {
  cpuUsage: 'cpuUsage',
  memoryUsage: 'memoryUsage',
}
const invalidMetricNames =runtimeBaseDefaultMetricNames.concat(Object.values(runtimeNodeDefaultMetricNames))

interface ProcessEnv {
  appName: string
  appVersion: string
  region: string
  vendor: string
  production: boolean
}

interface Key {
  name: string
}

interface Metric {
  Count: number
  Data: {
    key: Key
    processEnv: ProcessEnv
    summary: NumericSummary | NodeJS.MemoryUsage | NodeJS.CpuUsage
  }
  Max: number
  Min: number
  Name: string
  Sum: number
  Timestamp: number
  Unit: string
}

interface Samples {
  [key: string]: number[]
}

interface NumericSummary {
  count: number
  max: number
  median: number
  min: number
  percentile95: number
  percentile99: number
  sum: number
}

export class MetricsLogger {
  public add: (key: Key, value: number) => void
  public getSummaries: () => Metric[]

  constructor() {
    //////////////////////
    // private attributes
    //////////////////////

    let samples: Samples = {}
    let lastCpu: Snapshot = cpuSnapshot()

    //////////////////////
    // private methods definitions
    //////////////////////


    const summaries = compose<any, any, any, any>(
      reject(isNil),
      values,
      mapObjIndexed(getSummary)
    )

    function getDefaultStoredashProperties() {
      return {
        Count: 1,
        Max: 0,
        Min: 0,
        Name: 'runtime',
        Sum: 0,
        Timestamp: (new Date()).getTime(),
        Unit: '',
      }
    }

    function getProcessEnv(): ProcessEnv {
      return {
        appName: process.env.VTEX_APP_NAME || '',
        appVersion: process.env.VTEX_APP_VERSION || '',
        production: PRODUCTION,
        region: process.env.VTEX_REGION || '',
        vendor: process.env.VTEX_APP_VENDOR || '',
      }
    }

    function getCpuUsage(): Metric {
      const cpu = cpuSnapshot()
      const cpuDiff = snapshotDiff(cpu, lastCpu)
      lastCpu = cpu
      const metric = {
        Data: {
          key: {
            name:runtimeNodeDefaultMetricNames.cpuUsage,
          },
          processEnv: getProcessEnv(),
          summary: cpuDiff,
        },
        ...getDefaultStoredashProperties(),
      }
      return metric
    }

    function getMemoryUsage(): Metric {
      const metric = {
        Data: {
          key: {
            name:runtimeNodeDefaultMetricNames.memoryUsage,
          },
          processEnv: getProcessEnv(),
          summary: process.memoryUsage(),
        },
        ...getDefaultStoredashProperties(),
      }
      return metric
    }

    function getRuntimeSummaries(): Metric[] {
      return [getCpuUsage(), getMemoryUsage()]
    }

    function getSummary(vals: number[], strKey: string): Metric | null {
      if (strKey in samples) {
        const summary = getNumericSummary(vals)
        const keyObj = JSON.parse(strKey)
        const metric = {
          Data: {
            key: keyObj,
            processEnv: getProcessEnv(),
            summary,
          },
          ...getDefaultStoredashProperties(),
        }
        return metric
      }
      return null
    }

    // TODO: create some kind of alert/log if metric is not valid
    function validKey(key: Key): boolean {
      if (!('name' in key)) {
        return false
      }
      if (invalidMetricNames.includes(key.name)) {
        return false
      }
      try {
        stringify(key)
      } catch {
        return false
      }
      return true
    }

    function getStrKey(key: Key): string {
      return stringify(key)
    }

    function getNumericSummary (vals: number[]): NumericSummary {
      return {
        count: vals.length,
        max: Math.max(...vals),
        median: median(vals),
        min: Math.min(...vals),
        percentile95: percentile(vals, 0.95),
        percentile99: percentile(vals, 0.99),
        sum: sum(vals),
      }
    }

    //////////////////////
    // public methods definitions
    //////////////////////

    this.add = (key: Key, value: any): void => {
      if (validKey(key)) {
        const strKey = getStrKey(key)
        if (!(strKey in samples)) {
          samples[strKey] = []
        }
        samples[strKey].push(value)
      }
    }

    this.getSummaries = (): Metric[] => {
      const appSummaries = summaries(samples) as Metric[]
      samples = {}
      const runtimeSummaries = getRuntimeSummaries()
      return runtimeSummaries.concat(appSummaries)
    }

    //////////////////////
    // real constructor
    //////////////////////
  }
}
