import { Tags as OpentracingTags } from 'opentracing'
export { OpentracingTags }

/* tslint:disable:object-literal-sort-keys */

/**
 * The following tags are process tags - defined when the tracer is instantiated.
 * Those will annotate all spans created
 */
export const enum AppTags {
  /** Boolean indicating if the app is linked or not */
  VTEX_APP_LINKED = 'app.linked',

  /** The value of the NODE_ENV environment variable */
  VTEX_APP_NODE_ENV = 'app.node_env',

  /** The @vtex/api version used (e.g. '6.1.2') */
  VTEX_APP_NODE_VTEX_API_VERSION = 'app.node_vtex_api_version',

  /** The value of the VTEX_PRODUCTION environment variable - whether the app is in a production workspace */
  VTEX_APP_PRODUCTION = 'app.production',

  /** The value of the VTEX_REGION environment variable (e.g. 'aws-us-east-1') */
  VTEX_APP_REGION = 'app.region',

  /** The app version (e.g. '1.2.0') */
  VTEX_APP_VERSION = 'app.version',

  /** The workspace in which the app is installed or linked */
  VTEX_APP_WORKSPACE = 'app.workspace',
}

/** The following tags annotate the entrypoint span on incoming requests */
export const enum VTEXIncomingRequestTags {
  /** The account being served by the request */
  VTEX_ACCOUNT = 'vtex.incoming.account',

  /** The request id header value */
  VTEX_REQUEST_ID = 'vtex.request_id',

  /** The workspace being served by the request */
  VTEX_WORKSPACE = 'vtex.incoming.workspace',
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

  HTTP_RETRY_ERROR_CODE = 'http.retry.error.code',
  HTTP_RETRY_COUNT = 'http.retry.count',
}

export const UserlandTags = {
  ...OpentracingTags,
}
