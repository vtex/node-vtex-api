export interface OptionsListBindings {
  tenant: string
  adminUserAuthToken: string
}

export interface OptionsGetBinding {
  adminUserAuthToken: string
  bindingId: string
}

export interface Addr {
  host: string
  path: string
}

export interface OptionsCreateBinding {
  tenant: string
  adminUserAuthToken: string
  defaultLocale: string
  supportedLocales: string[]
  salesChannelId: number | null
  addrs: Addr[]
  canonicalAddr: Addr
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

export interface APICreateBindingRes {
  Id: string
}
