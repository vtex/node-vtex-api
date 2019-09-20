export const DEFAULT_WORKSPACE = 'master'

export const SEGMENT_HEADER = 'x-vtex-segment'
export const SESSION_HEADER = 'x-vtex-session'
export const PRODUCT_HEADER = 'x-vtex-product'
export const LOCALE_HEADER = 'x-vtex-locale'
export const FORWARDED_HOST_HEADER = 'x-forwarded-host'
export const TENANT_HEADER = 'x-vtex-tenant'

export type VaryHeaders = typeof SEGMENT_HEADER | typeof SESSION_HEADER | typeof PRODUCT_HEADER | typeof LOCALE_HEADER

export const BODY_HASH = '__graphqlBodyHash'
