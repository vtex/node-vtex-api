export type Policy = {
  name: string,
}

export type AppManifest = {
  [_extra: string]: any // internal fields like _id, _link, _registry
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

export type FileListItem = {
  path: string,
  hash: string,
}

export type AppFilesList = {
  data: FileListItem[],
}

export type BucketMetadata = {
  state: string,
  lastModified: string,
  hash: string,
}

export type BillingOptions = {
  free?: boolean
  policies?: BillingPolicy[]
  termsURL: string
  support: Support
}

export type BillingPolicy = {
  currency: string,
  billing: BillingChargeElements,
}

export type BillingChargeElements = {
  taxClassification: string,
  items: CalculationItem[],
}

export type CalculationItem = {
  itemCurrency: string,
  fixed?: number,
  calculatedByMetricUnit?: CalculatedByMetricUnit,
}

export type CalculatedByMetricUnit = {
  metricId: string
  metricName: string
  minChargeValue?: number
  ranges: Range[]
  route: string
}

export type Range = {
  exclusiveFrom: number,
  inclusiveTo?: number,
  multiplier: number,
}

export type Support = {
  email?: string
  url?: string
}
