import { forWorkspace, IODataSource } from '../IODataSource'

export class Billing extends IODataSource {
  protected service = 'billing.vtex'
  protected httpClientFactory = forWorkspace

  public status = () =>
    this.http.get<ContractStatus>('/_v/contractStatus')
}

export enum ContractStatus {
  ACTIVE = 'active_contract',
  INACTIVE = 'inactive_contract',
  NO_CONTRACT = 'no_contract',
}
