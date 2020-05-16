/* tslint:disable:object-literal-sort-keys */

// When using span.log({ field1: string1, field2: object2, ... })
// The jaeger backend indexes for search the first-level fields that hold strings
// These fields then can be searched on jaeger-ui using: 'field1=string'
// This file concentrates all log fieds used in node-vtex-api that hold
// strings and can be searched in the jaeger-ui

const ERROR_REPORT = {
  // ErrorReport class has some meta info on the error
  // The following log fieds hold this meta info
  ERROR_KIND: 'error.kind',
  // tslint:disable-

  ERROR_ID: 'error.id',

  // VTEX's Infra errors adds error details to the response
  // The following log fields are supposed to hold these fields
  ERROR_SERVER_CODE: 'error.server.code',
  ERROR_SERVER_REQUEST_ID: 'error.server.request_id',
}

export const LOG_FIELDS = {
  EVENT: 'event',
  ...ERROR_REPORT,
}
