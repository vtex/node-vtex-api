import { Tags as OpentracingTags } from 'opentracing'
export { OpentracingTags }

/* tslint:disable:object-literal-sort-keys */

export const VTEXIncomingRequestTags = {
  VTEX_ACCOUNT: 'vtex.incoming.account',
  VTEX_REQUEST_ID: 'vtex.request_id',
  VTEX_WORKSPACE: 'vtex.incoming.workspace',
}

export const AppTags = {
  VTEX_APP_LINKED: 'app.linked',
  VTEX_APP_NODE_ENV: 'app.node_env',
  VTEX_APP_NODE_VTEX_API_VERSION: 'app.node_vtex_api_version',
  VTEX_APP_PRODUCTION: 'app.production',
  VTEX_APP_REGION: 'app.region',
  VTEX_APP_VERSION: 'app.version',
  VTEX_APP_WORKSPACE: 'app.workspace',
}

export const enum CustomHttpTags {
  HTTP_PATH = 'http.path',

  /** Set to true when the client had no response, probably meaning that there was a client error */
  HTTP_NO_RESPONSE = 'http.no_response',

  /** The HTTP client name (e.g. Apps, Registry, Router) */
  HTTP_CLIENT_NAME = 'http.client.name',

  /**
   * CACHE_ENABLED tags indicate if the Cache strategy is enabled
   * for the specific request.
   *
   */
  HTTP_MEMOIZATION_CACHE_ENABLED = 'http.cache.memoization.enabled',
  HTTP_DISK_CACHE_ENABLED = 'http.cache.disk.enabled',
  HTTP_MEMORY_CACHE_ENABLED = 'http.cache.memory.enabled',

  /**
   * CACHE_RESULT tags indicate the result for that cache strategy
   * (HIT or MISS for example). Since there may be many layers
   * of cache a ENABLED flag for a strategy may be 'true', but
   * the RESULT for that strategy may not be present.
   */
  HTTP_MEMORY_CACHE_RESULT = 'http.cache.memory',
  HTTP_MEMOIZATION_CACHE_RESULT = 'http.cache.memoization',
  HTTP_DISK_CACHE_RESULT = 'http.cache.disk',
  HTTP_ROUTER_CACHE_RESULT = 'http.cache.router',
}

export const UserlandTags = {
  ...OpentracingTags,
}
