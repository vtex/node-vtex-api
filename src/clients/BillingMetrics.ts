import { forWorkspace, IODataSource } from '../IODataSource'

export class BillingMetrics extends IODataSource {
  protected service = 'colossus'
  protected httpClientFactory = forWorkspace

  public sendMetric = (metric: BillingMetric) =>
    this.http.post<BillingMetric>('/metrics', metric)
}

export interface BillingMetric {
  value: number
  unit: string
  metricId: string
  timestamp?: number
}
