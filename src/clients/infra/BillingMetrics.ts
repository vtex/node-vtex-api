import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

export class BillingMetrics extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('colossus@0.x', context, options)
  }

  public sendMetric = (metric: BillingMetric, tracingConfig?: RequestTracingConfig) => {
    return this.http.post<BillingMetric>('/metrics', metric, { tracing: {
      requestSpanNameSuffix: 'send-metric',
      ...tracingConfig?.tracing,
    }})
  }
}

export interface BillingMetric {
  value: number
  unit: string
  metricId: string
  timestamp?: number
}
