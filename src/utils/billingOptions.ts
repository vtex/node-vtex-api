import { isNil } from 'ramda'

import { BillingOptions, CalculationItem, FixedCalculationItem, FreeBillingOptions, LegacyFreeBillingOptions } from '../responses'

export const isFreeBillingOptions = (billingOptions: BillingOptions): billingOptions is FreeBillingOptions | LegacyFreeBillingOptions =>
  (billingOptions as LegacyFreeBillingOptions).free || (billingOptions as FreeBillingOptions).type === 'free'

export const isFixedCalculationItem = (item: CalculationItem): item is FixedCalculationItem =>
  !isNil((item as FixedCalculationItem).fixed)
