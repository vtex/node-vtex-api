export interface Policy {
  name: string,
  attrs?: {
    [name: string]: string,
  }
}

interface PublicAppManifest {
  vendor: string,
  name: string,
  version: string,
  title?: string,
  description?: string,
  mustUpdateAt?: string,
  builders: {
    [name: string]: string,
  }
  categories?: string[],
  dependencies?: {
    [name: string]: string,
  },
  peerDependencies?: {
    [name: string]: string,
  },
  settingsSchema?: any,
  registries?: string[],
  credentialType?: string,
  policies?: Policy[],
  billingOptions?: BillingOptions,
}

export interface AppManifest extends PublicAppManifest {
  [internal: string]: any // internal fields like _id, _link, _registry
  _resolvedDependencies?: {
    [name: string]: string[],
  },
}

export interface FileListItem {
  path: string,
  hash: string,
}

export interface AppFilesList {
  data: FileListItem[],
}

export interface BucketMetadata {
  state: string,
  lastModified: string,
  hash: string,
}

export interface RootBillingOptions {
  termsURL: string
  support: Support
  setupRoute?: string
}

export interface FreeBillingOptions extends RootBillingOptions {
  type: 'free'
}

export interface LegacyFreeBillingOptions extends RootBillingOptions {
  free: true
}

export interface ChargeableBillingOptions extends RootBillingOptions {
  type: 'chargeable'
  policies: BillingPolicy[],
}

export interface LegacyChargeableBillingOptions extends RootBillingOptions {
  free?: false
  policies: BillingPolicy[]
}

export interface SponsoredBillingOptions extends RootBillingOptions {
  type: 'sponsored'
}

export interface Support {
  url: string
  email: string
}

export type BillingOptions = FreeBillingOptions | ChargeableBillingOptions | SponsoredBillingOptions | LegacyFreeBillingOptions | LegacyChargeableBillingOptions

export interface BillingPolicy {
  currency: string,
  billing: BillingChargeElements,
}

export interface BillingChargeElements {
  taxClassification: string,
  items: CalculationItem[],
}

export interface RootCalculationItem {
  itemCurrency: string
}

export interface FixedCalculationItem extends RootCalculationItem {
  fixed: number
}

export interface MetricBasedCalculationItem extends RootCalculationItem {
  calculatedByMetricUnit: CalculatedByMetricUnit
}

export type CalculationItem = FixedCalculationItem | MetricBasedCalculationItem

export interface CalculatedByMetricUnit {
  metricId: string,
  metricName: string,
  ranges: Range[],
  metricsRoute?: string,
}

export interface Range {
  exclusiveFrom: number,
  inclusiveTo?: number,
  multiplier: number,
}

export interface AppBundleResponse {
  message: string,
  id: string,
}

export type AppBundlePublished = AppBundleResponse & {
  bundleSize?: number,
}

export type AppBundleLinked = AppBundleResponse & {
  bundleSize?: number,
}

export interface HouseKeeperState {
  infra: string[]
  edition: string[]
 runtimes: string[]
  apps: Array<{id: string, source: string}>
}

export interface HouseKeeperUpdates extends HouseKeeperState {
  editionApps?: {
    install?: string[]
    uninstall?: string[]
  }
}

export interface HousekeeperStatesAndUpdates {
  state: HouseKeeperState
  updates: HouseKeeperUpdates
}
