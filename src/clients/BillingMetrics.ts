import { InfraClient, InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/typings'

export class BillingMetrics extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('colossus@0.x', context, options)
  }

  public sendMetric = (metric: BillingMetric) =>
    this.http.post<BillingMetric>('/metrics', metric)
}

export interface BillingMetric {
  value: number
  unit: string
  metricId: string
  timestamp?: number
}
