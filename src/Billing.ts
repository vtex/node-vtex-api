import { HttpClient, InstanceOptions, IOContext } from './HttpClient'

const routes = {
  contractStatus: '/_v/contractStatus',
}

export class Billing {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forWorkspace('billing.vtex', ioContext, opts)
  }

  public contractStatus = () => {
    return this.http.get<ContractStatus>(routes.contractStatus)
  }
}

export enum ContractStatus {
  ACTIVE = 'active_contract',
  INACTIVE = 'inactive_contract',
  NO_CONTRACT = 'no_contract',
}
