import { InstanceOptions } from '../HttpClient'
import { forWorkspace, IODataSource } from '../IODataSource'
import { IOContext } from '../service/typings'

const metricRoute = `/metrics`

const routes = {
  contractStatus: '/_v/contractStatus',
}

export class Billing extends IODataSource {
  protected service = 'billing.vtex'
  protected httpClientFactory = forWorkspace
  protected metrics: Metrics

  constructor (context?: IOContext, options: InstanceOptions = {}) {
    super(context, options)
    this.metrics = new Metrics(context, options)
  }

  public status = () =>
    this.http.get<ContractStatus>(routes.contractStatus)

  public sendMetric = (metric: BillingMetric) =>
    this.metrics.sendMetric(metric)
}

// tslint:disable-next-line:max-classes-per-file
class Metrics extends IODataSource {
  protected service = 'colossus'
  protected httpClientFactory = forWorkspace

  public sendMetric = (metric: BillingMetric) =>
    this.http.post<BillingMetric>(metricRoute, metric)
}

export enum ContractStatus {
  ACTIVE = 'active_contract',
  INACTIVE = 'inactive_contract',
  NO_CONTRACT = 'no_contract',
}

export interface BillingMetric {
  value: number,
  unit: string,
  metricId: string,
  timestamp?: number,
}
