export interface APIAddress {
  Host: string
  IsCanonical: boolean
  BasePath: string
  Localization: {
    [k: string]: string
  }
}

export interface APIBindingRes {
  Id: string
  Addresses: APIAddress[]
  SiteName: string
  DefaultSalesChannelId: number | null
  DefaultLocale: string
  SupportedLocales: string[]
}
