export interface OptionsListBindings {
  tenant: string
  adminUserAuthToken: string
}

export interface APIAddress {
  Host: string
  IsCanonical: boolean
  BasePath: string
  Localization: {
    [k: string]: string
  }
}

export interface APIBindingCreate {
  Addresses: APIAddress[]
  SiteName: string
  DefaultSalesChannelId: number | null
  DefaultLocale: string
  SupportedLocales: string[]
}

export interface APIBindingRes extends APIBindingCreate {
  Id: string
}
