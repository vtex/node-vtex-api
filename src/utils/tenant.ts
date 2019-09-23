export interface Tenant {
  locale: string
}

export const formatTenantHeaderValue = (tenant: Tenant): string => tenant.locale

export const parseTenantHeaderValue = (value: string): Tenant => ({
  locale: value,
})
