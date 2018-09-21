export interface Policy {
  name: string,
}

export interface AppManifest {
  [internal: string]: any // internal fields like _id, _link, _registry
  vendor: string,
  name: string,
  version: string,
  title: string,
  description: string,
  categories: string[],
  dependencies: {
    [name: string]: string,
  },
  peerDependencies: {
    [name: string]: string,
  },
  settingsSchema: any,
  registries: string[],
  credentialType: string,
  policies: Policy[],
  billingOptions: BillingOptions,
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

export interface BillingOptions {
  version?: string,
  free?: boolean,
  policies?: BillingPolicy[],
  deactivationRoute?: string,
  termsURL: string,
}

export interface BillingPolicy {
  currency: string,
  billing: BillingChargeElements,
}

export interface BillingChargeElements {
  taxClassification: string,
  items: CalculationItem[],
}

export interface CalculationItem {
  itemCurrency: string,
  fixed: number,
  calculatedByMetricUnit: CalculatedByMetricUnit,
}

export interface CalculatedByMetricUnit {
  metricId: string,
  metricName: string,
  ranges: Range[],
  route: string,
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
