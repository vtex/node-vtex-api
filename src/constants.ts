import { versionToMajor } from './utils/app'
import {
  ATTR_VTEX_ACCOUNT_NAME,
  ATTR_VTEX_IO_WORKSPACE_NAME,
  ATTR_VTEX_IO_WORKSPACE_TYPE,
  ATTR_VTEX_IO_APP_ID,
  ATTR_VTEX_IO_APP_AUTHOR_TYPE
} from '@vtex/diagnostics-semconv'

// tslint:disable-next-line
const pkg = require('../package.json')

export const NODE_VTEX_API_VERSION = pkg.version
export const DEFAULT_WORKSPACE = 'master'
export const IS_IO = process.env.VTEX_IO
export const PID = process.pid

export const HeaderKeys = {
  CACHE_CONTROL: 'cache-control',
  SEGMENT: 'x-vtex-segment',
  SESSION: 'x-vtex-session',
  PRODUCT: 'x-vtex-product',
  LOCALE: 'x-vtex-locale',
  FORWARDED_HOST: 'x-forwarded-host',
  FORWARDED_FOR: 'x-forwarded-for',
  TENANT: 'x-vtex-tenant',
  BINDING: 'x-vtex-binding',
  META: 'x-vtex-meta',
  META_BUCKET: 'x-vtex-meta-bucket',
  ETAG: 'etag',
  ACCOUNT: 'x-vtex-account',
  CREDENTIAL: 'x-vtex-credential',
  REQUEST_ID: 'x-request-id',
  ROUTER_CACHE: 'x-router-cache',
  OPERATION_ID: 'x-vtex-operation-id',
  PLATFORM: 'x-vtex-platform',
  WORKSPACE_IS_PRODUCTION: 'x-vtex-workspace-is-production',
  WORKSPACE: 'x-vtex-workspace',
  EVENT_KEY: 'x-event-key',
  EVENT_SENDER: 'x-event-sender',
  EVENT_SUBJECT: 'x-event-subject',
  EVENT_HANDLER_ID: 'x-event-handler-id',
  COLOSSUS_ROUTE_DECLARER: 'x-colossus-route-declarer',
  COLOSSUS_ROUTE_ID: 'x-colossus-route-id',
  COLOSSUS_PARAMS: 'x-colossus-params',
  TRACE_ID: 'x-trace-id',
  PROVIDER: 'x-vtex-provider',
  USER_AGENT: 'user-agent',
  VTEX_USER_AGENT: 'x-vtex-user-agent',
  VTEX_IO_CALLER: 'x-vtex-io-caller',
  VTEX_APP_SERVICE: 'x-vtex-app-service',
  VTEX_APP_KEY: 'x-vtex-app-key',
  VTEX_RETRY_COUNT: 'x-vtex-retry-count'
}

export const AttributeKeys = {
  // VTEX Semantic Attributes
  VTEX_ACCOUNT_NAME: ATTR_VTEX_ACCOUNT_NAME,

  // VTEX IO Semantic Attributes
  VTEX_IO_WORKSPACE_NAME: ATTR_VTEX_IO_WORKSPACE_NAME,
  VTEX_IO_WORKSPACE_TYPE: ATTR_VTEX_IO_WORKSPACE_TYPE,
  VTEX_IO_APP_ID: ATTR_VTEX_IO_APP_ID,
  VTEX_IO_APP_AUTHOR_TYPE: ATTR_VTEX_IO_APP_AUTHOR_TYPE,
}

export type VaryHeaders = typeof HeaderKeys.SEGMENT | typeof HeaderKeys.SESSION | typeof HeaderKeys.PRODUCT | typeof HeaderKeys.LOCALE

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

export const LOG_CLIENT_INIT_TIMEOUT_MS = 5000
export const METRIC_CLIENT_INIT_TIMEOUT_MS = 5000

export const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT as string;

export const DK_APP_ID = process.env.NODE_VTEX_API_DK_APP_ID as string || "apps-team";

export const DIAGNOSTICS_TELEMETRY_ENABLED = process.env.VTEX_DIAGNOSTICS_TELEMETRY_ENABLED === 'true';