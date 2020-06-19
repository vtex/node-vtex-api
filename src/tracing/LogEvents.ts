/* tslint:disable:object-literal-sort-keys */

/**
 * This file has all events logged by the runtime's distributed tracing
 * istrumentation. In the code you would see something like:
 * ```
 * span.log({ event: HttpEvents.CACHE_KEY_CREATE })
 * ```
 */

export const enum HttpLogEvents {
  /** Event holding the cache key created */
  CACHE_KEY_CREATE = 'cache-key-created',

  /** Event representing that the memoization cache has just saved a response */
  MEMOIZATION_CACHE_SAVED = 'memoization-cache-saved',

  /** Event representing that the memoization cache has just saved a error response */
  MEMOIZATION_CACHE_SAVED_ERROR = 'memoization-cache-saved-error',

  /** Event holding information on a local cache hit that just happened */
  LOCAL_CACHE_HIT_INFO = 'local-cache-hit-info',

  /** Event holding information on the cache config to decide on updating the local cache */
  CACHE_CONFIG = 'cache-config',

  /** Event informing the decision to not update or save to local cache */
  NO_LOCAL_CACHE_SAVE = 'no-local-cache-save',

  /** Event holding information on the local cache save that just happened */
  LOCAL_CACHE_SAVED = 'local-cache-saved',
}

export const enum RuntimeLogEvents {
  /** Event representing that userland middlewares are about to start */
  USER_MIDDLEWARES_START = 'user-middlewares-start',

  /** Event representing that userland middlewares just finished */
  USER_MIDDLEWARES_FINISH = 'user-middlewares-finish',
}
