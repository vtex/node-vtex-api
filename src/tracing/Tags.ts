import { Tags as opentracingTags } from 'opentracing'

const VTEX_INCOMING_REQUEST_TAGS = {
  /** The incoming request's origin account */
  VTEX_ACCOUNT: 'vtex.incoming.account',

  /** The incoming request's origin workspace */
  VTEX_WORKSPACE: 'vtex.incoming.workspace',

  /** The incoming request' requestID */
  VTEX_REQUEST_ID: 'vtex.request_id',
}

const APP_TAGS = {
  /** Specifies if the app is linked (true) or not (false) */
  VTEX_APP_LINKED: 'app.linked',

  /** The value defined for the NODE_ENV environment variable */
  VTEX_APP_NODE_ENV: 'app.node_env',

  /** The version of @vtex/api in use */
  VTEX_APP_NODE_VTEX_API_VERSION: 'app.node_vtex_api_version',

  /**
   * The value of VTEX_PRODUCTION environment variable
   * which specifies if the workspace in which the app is installed
   * is a production one
   */
  VTEX_APP_PRODUCTION: 'app.production',

  /** The regin the app's pod is running (e.g aws-us-east-1) */
  VTEX_APP_REGION: 'app.region',

  /** The app's exact version */
  VTEX_APP_VERSION: 'app.version',

  /** The workspace in which the app is linked/installed */
  VTEX_APP_WORKSPACE: 'app.workspace',
}

export const USERLAND_TAGS = {
  ...opentracingTags,
}

export const Tags = {
  /** This flag is set to true if a http request didn't produced response, meaning that there was a client error */
  HTTP_NO_RESPONSE: 'http.no_response',

  /** The URL's path */
  HTTP_PATH: 'http.path',

  /** The retry number this span represents (e.g. try number 0, try number 1, ...) */
  HTTP_RETRY_COUNT: 'http.retry_count',

  /** If present, this tag will hold the value on the router cache response' header */
  HTTP_ROUTER_CACHE: 'http.router_cache',
  ...USERLAND_TAGS,
  ...VTEX_INCOMING_REQUEST_TAGS,
  ...APP_TAGS,
}
