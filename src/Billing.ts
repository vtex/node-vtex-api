import { HttpClient, InstanceOptions, IOContext } from './HttpClient'

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

export interface BillingOptions {
  free?: boolean
  policies?: Policy[]
  termsURL: string
  support: Support
}

export interface Support {
  email?: string
  url?: string
}

export interface Policy {
  plan: string
  currency: string
  billing: Billing
}

export interface Billing {
  taxClassification: string
  invoiceProvider: string
  items: CalculationItem[]
}

export interface CalculationItem {
  itemCurrency: string
  fixed: number
  calculatedByMetricUnit: CalculatedByMetricUnit
}

export interface CalculatedByMetricUnit {
  metricId: string
  metricName: string
  minChargeValue: number
  ranges: Range[]
  route: string
}

export interface Range {
  exclusiveFrom: number
  inclusiveTo: number
  multiplier: number
}
