import { Tags as opentracingTags } from 'opentracing'

const VTEX_INCOMING_REQUEST_TAGS = {
  VTEX_ACCOUNT: 'vtex.incoming.account',
  VTEX_REQUEST_ID: 'vtex.request_id',
  VTEX_WORKSPACE: 'vtex.incoming.workspace',
}

const APP_TAGS = {
  VTEX_APP_LINKED: 'app.linked',
  VTEX_APP_NODE_ENV: 'app.node_env',
  VTEX_APP_NODE_VTEX_API_VERSION: 'app.node_vtex_api_version',
  VTEX_APP_PRODUCTION: 'app.production',
  VTEX_APP_REGION: 'app.region',
  VTEX_APP_VERSION: 'app.version',
  VTEX_APP_WORKSPACE: 'app.workspace',
}

const ERROR_REPORT_TAGS = {
  ERROR_KIND: 'error.kind',
  ERROR_SERVER_CODE: 'error.server.code',
  ERROR_SERVER_REQUEST_ID: 'error.server.request_id',
  ERROR_SERVER_SOURCE: 'error.server.source',
}

export const USERLAND_TAGS = {
  ...ERROR_REPORT_TAGS,
  ...opentracingTags,
}

export const Tags = {
  HTTP_NO_RESPONSE: 'http.no_response',
  HTTP_PATH: 'http.path',
  HTTP_RETRY_COUNT: 'http.retry_count',
  HTTP_ROUTER_CACHE: 'http.router_cache',
  ...USERLAND_TAGS,
  ...VTEX_INCOMING_REQUEST_TAGS,
  ...APP_TAGS,
}