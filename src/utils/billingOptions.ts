export const isFreeBillingOptions = (billingOptions: BillingOptions): boolean =>
  billingOptions.type === BILLING_TYPE.FREE
export interface BillingOptions {
  type: BILLING_TYPE
  support: Support
  availableCountries: string[]
  plans?: Plan[]
}

export enum BILLING_TYPE {
  FREE = 'free',
  BILLABLE = 'billable',
  SPONSORED = 'sponsored',
}

export interface PriceMetric {
  id: string
  ranges: Range[]
  customUrl: string
}

export interface Range {
  exclusiveFrom: number
  inclusiveTo?: number
  multiplier: number
}

export interface Plan {
  id: string
  currency: string
  price: Price
}

export interface Price {
  subscription?: number
  metrics?: PriceMetric[]
}

export interface Support {
  email: string
  url?: string
  phone?: string
}
