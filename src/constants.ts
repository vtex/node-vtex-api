import { versionToMajor } from './utils/app'
// tslint:disable-next-line
const pkg = require('../package.json')

export const NODE_VTEX_API_VERSION = pkg.version
export const DEFAULT_WORKSPACE = 'master'
export const IS_IO = process.env.VTEX_IO
export const PID = process.pid

export const CACHE_CONTROL_HEADER = 'cache-control'
export const SEGMENT_HEADER = 'x-vtex-segment'
export const SESSION_HEADER = 'x-vtex-session'
export const PRODUCT_HEADER = 'x-vtex-product'
export const LOCALE_HEADER = 'x-vtex-locale'
export const FORWARDED_HOST_HEADER = 'x-forwarded-host'
export const TENANT_HEADER = 'x-vtex-tenant'
export const BINDING_HEADER = 'x-vtex-binding'
export const META_HEADER = 'x-vtex-meta'
export const META_HEADER_BUCKET = 'x-vtex-meta-bucket'
export const ETAG_HEADER = 'etag'
export const ACCOUNT_HEADER = 'x-vtex-account'
export const CREDENTIAL_HEADER = 'x-vtex-credential'
export const REQUEST_ID_HEADER = 'x-request-id'
export const ROUTER_CACHE_HEADER = 'x-router-cache'
export const OPERATION_ID_HEADER = 'x-vtex-operation-id'
export const PLATFORM_HEADER = 'x-vtex-platform'
export const WORKSPACE_IS_PRODUCTION_HEADER = 'x-vtex-workspace-is-production'
export const WORKSPACE_HEADER = 'x-vtex-workspace'
export const EVENT_KEY_HEADER = 'x-event-key'
export const EVENT_SENDER_HEADER = 'x-event-sender'
export const EVENT_SUBJECT_HEADER = 'x-event-subject'
export const EVENT_HANDLER_ID_HEADER = 'x-event-handler-id'
export const COLOSSUS_ROUTE_DECLARER_HEADER = 'x-colossus-route-declarer'
export const COLOSSUS_ROUTE_ID_HEADER = 'x-colossus-route-id'
export const COLOSSUS_PARAMS_HEADER = 'x-colossus-params'
export const TRACE_ID_HEADER = 'x-trace-id'
export const PROVIDER_HEADER = 'x-vtex-provider'

export type VaryHeaders = typeof SEGMENT_HEADER | typeof SESSION_HEADER | typeof PRODUCT_HEADER | typeof LOCALE_HEADER

export const BODY_HASH = '__graphqlBodyHash'

export const UP_SIGNAL = 'UP'

export const MAX_AGE = {
  LONG: 86400,
  MEDIUM: 3600,
  SHORT: 120,
}

export const HTTP_SERVER_PORT = 5050
export const MAX_WORKERS = 4

export const LINKED = !!process.env.VTEX_APP_LINK
export const REGION = process.env.VTEX_REGION as string
export const PUBLIC_ENDPOINT = process.env.VTEX_PUBLIC_ENDPOINT || 'myvtex.com'
export const APP = {
  ID: process.env.VTEX_APP_ID as string,
  MAJOR: process.env.VTEX_APP_VERSION ? versionToMajor(process.env.VTEX_APP_VERSION) : '',
  NAME: process.env.VTEX_APP_NAME as string,
  VENDOR: process.env.VTEX_APP_VENDOR as string,
  VERSION: process.env.VTEX_APP_VERSION as string,
  IS_THIRD_PARTY() {
    return 'vtex' !== this.VENDOR && 'gocommerce' !== this.VENDOR
  },
}
export const NODE_ENV = process.env.NODE_ENV as string
export const ACCOUNT = process.env.VTEX_ACCOUNT as string
export const WORKSPACE = process.env.VTEX_WORKSPACE as string
export const PRODUCTION = process.env.VTEX_PRODUCTION === 'true'

export const INSPECT_DEBUGGER_PORT = 5858

export const cancellableMethods = new Set(['GET', 'OPTIONS', 'HEAD'])
