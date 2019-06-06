import { InfraClient, InstanceOptions } from '../HttpClient'
import { BaseIOContext } from '../service/typings'

export class BillingMetrics extends InfraClient {
  constructor(context: BaseIOContext, options?: InstanceOptions) {
    super('colossus', context, options)
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
