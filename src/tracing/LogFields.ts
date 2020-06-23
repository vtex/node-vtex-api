/* tslint:disable:object-literal-sort-keys */

/**
 * When using span.log({ field1: string1, field2: object2, ... })
 * The jaeger backend indexes for search the first-level fields that hold strings
 * These fields then can be searched on jaeger-ui using: 'field1=string'
 * This file concentrates all log fields used in node-vtex-api that hold
 * strings and can be searched in the jaeger-ui
 */

export const enum ErrorReportLogFields {
  /**
   * ErrorReport class has some meta info on the error
   * The following log fields hold this meta info
   */
  ERROR_KIND = 'error.kind',
  ERROR_ID = 'error.id',

  /**
   * VTEX's Infra errors adds error details to the response
   * The following log fields are supposed to hold these fields
   */
  ERROR_SERVER_CODE = 'error.server.code',
  ERROR_SERVER_REQUEST_ID = 'error.server.request_id',
}

export const enum RuntimeLogFields {
  /** Time in ms spent to run the user middlewares */
  USER_MIDDLEWARES_DURATION = 'user-middlewares-duration',
}

export const enum HttpCacheLogFields {
  /** The generated cache key for Memoization or Local caches */
  KEY = 'key',

  /** The generated cache key for local cache with the segment added to it */
  KEY_WITH_SEGMENT = 'key-with-segment',

  /** The key that was just set on the cache */
  KEY_SET = 'key-set',

  /** The type of cache: 'disk', 'memory' or 'memoization' */
  CACHE_TYPE = 'cache-type',

  /** The etag for the current request used for caching decisions. Can be undefined. */
  ETAG = 'etag',

  /** The expiration time in seconds of the current cache entry (either just saved or fetched from the storage) */
  EXPIRATION_TIME = 'expiration-time',

  /** The http response type. Can be undefined. */
  RESPONSE_TYPE = 'response-type',

  /** The http response encoding. Can be undefined. */
  RESPONSE_ENCONDING = 'response-encoding',

  /**
   * The forceMaxAge option on the incoming RequestConfig. This can be set to override no-cache or no-store headers.
   * Can be undefined.
   */
  FORCE_MAX_AGE = 'force-max-age',

  /** The calculated max-age the current response will have if stored */
  CALCULATED_MAX_AGE = 'calculated-max-age',

  /** Content parsed from the incoming response headers */
  AGE = 'age',
  NO_CACHE = 'no-cache',
  NO_STORE = 'no-store',
  MAX_AGE = 'max-age',
}

export const enum HttpRetryLogFields {
  /** The retry number scheduled (e.g, 1, 2, meaning that is the first or second retry) */
  RETRY_NUMBER = 'retry-number',

  /** How much time in ms will be waited until this retry happens */
  RETRY_IN = 'retry-in',
}
