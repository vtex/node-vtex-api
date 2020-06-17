/* tslint:disable:object-literal-sort-keys */

/**
 * When using span.log({ field1: string1, field2: object2, ... })
 * The jaeger backend indexes for search the first-level fields that hold strings
 * These fields then can be searched on jaeger-ui using: 'field1=string'
 * This file concentrates all log fields used in node-vtex-api that hold
 * strings and can be searched in the jaeger-ui
 */

const ERROR_REPORT = {
  /**
   * ErrorReport class has some meta info on the error
   * The following log fields hold this meta info
   */
  ERROR_KIND: 'error.kind',
  ERROR_ID: 'error.id',

  /**
   * VTEX's Infra errors adds error details to the response
   * The following log fields are supposed to hold these fields
   */
  ERROR_SERVER_CODE: 'error.server.code',
  ERROR_SERVER_REQUEST_ID: 'error.server.request_id',
}

export const LOG_FIELDS = {
  EVENT: 'event',
  
  /** Time in ms spent to run the user middlewares */
  USER_MIDDLEWARES_DURATION: 'user-middlewares-duration',
  ...ERROR_REPORT,
}

export const LOG_EVENTS = {
  /** Event representing that userland middlewares are about to start */
  USER_MIDDLEWARES_START: 'user-middlewares-start',

  /** Event representing that userland middlewares just finished */
  USER_MIDDLEWARES_FINISH: 'user-middlewares-finish',
}
