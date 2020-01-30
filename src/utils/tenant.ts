export interface TenantHeader {
  locale: string
}

export const formatTenantHeaderValue = (tenant: TenantHeader): string => tenant.locale

export const parseTenantHeaderValue = (value: string): TenantHeader => ({
  locale: value,
})
