import {forWorkspace, IODataSource} from './dataSources'

const metricRoute = `/metrics`

const routes = {
  contractStatus: '/_v/contractStatus',
}

export class Billing extends IODataSource {
  protected service = 'billing.vtex'
  protected httpClientFactory = forWorkspace

  public contractStatus = () => {
    return this.http.get<ContractStatus>(routes.contractStatus)
  }

  public sendMetric = (metric: BillingMetric) => {
    return this.http.post(metricRoute, metric)
  }
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
