import { HttpClient, InstanceOptions, IOContext } from './HttpClient'
import { BillingOptions } from './responses'

const routes = {
  contractStatus: '/_v/contractStatus',
  validate: '/_v/validate',
}

export class Billing {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forWorkspace('billing.vtex', ioContext, opts)
  }

  contractStatus = async () => {
    return this.http.get<ContractStatus>(routes.contractStatus)
  }

  validateBillingOptions = async (billingOptions: BillingOptions) => {
    return this.http.post<void | ValidationError>(routes.validate, billingOptions)
  }
}

export enum ContractStatus {
  ACTIVE = 'active_contract',
  INACTIVE = 'inactive_contract',
  NO_CONTRACT = 'no_contract',
}

export type ValidationError = {
  error: {
    message: string
    name: string,
  },
}
