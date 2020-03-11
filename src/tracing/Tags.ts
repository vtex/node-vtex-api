import { Tags as opentracingTags } from 'opentracing'

const VTEX_INCOMING_REQUEST_TAGS = {
  VTEX_ACCOUNT: 'vtex.account',
  VTEX_WORKSPACE: 'vtex.workspace',
}

const APP_TAGS = {
  VTEX_APP_LINKED: 'app.linked',
  VTEX_APP_NODE_VTEX_API_VERSION: 'app.node-vtex-api-version',
  VTEX_APP_PRODUCTION: 'app.production',
  VTEX_APP_REGION: 'app.region',
  VTEX_APP_VERSION: 'app.version',
  VTEX_APP_WORKSPACE: 'app.workspace',
}

export const Tags = {
  ERROR_KIND: 'error.kind',
  HTTP_NO_RESPONSE: 'http.no-response',
  HTTP_PATH: 'http.path',
  HTTP_ROUTER_CACHE: 'http.router-cache',
  ...VTEX_INCOMING_REQUEST_TAGS,
  ...APP_TAGS,
  ...opentracingTags,
}
