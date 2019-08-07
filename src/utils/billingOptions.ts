import { isNil } from 'ramda'

import {
  BillingOptions,
  CalculationItem,
  FixedCalculationItem,
  FreeBillingOptions,
} from '../responses'

export const isFreeBillingOptions = (
  billingOptions: BillingOptions
): billingOptions is FreeBillingOptions =>
  (billingOptions as FreeBillingOptions).free

export const isFixedCalculationItem = (
  item: CalculationItem
): item is FixedCalculationItem => !isNil((item as FixedCalculationItem).fixed)
