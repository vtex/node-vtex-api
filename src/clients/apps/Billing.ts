import { InstanceOptions } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { AppClient } from './AppClient'

export class Billing extends AppClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('vtex.billing@0.x', context, options)
  }

  public status = () => this.http.get<ContractStatus>('/_v/contractStatus')
}

export enum ContractStatus {
  ACTIVE = 'active_contract',
  INACTIVE = 'inactive_contract',
  NO_CONTRACT = 'no_contract',
}
