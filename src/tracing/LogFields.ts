/* tslint:disable:object-literal-sort-keys */

// When using span.log({ field1: string1, field2: object2, ... })
// The jaeger backend indexes for search the first-level fields that hold strings
// These fields then can be searched on jaeger-ui using: 'field1=string'
// This file concentrates all log fields used in node-vtex-api that hold
// strings and can be searched in the jaeger-ui

const ERROR_REPORT = {
  // ErrorReport class has some meta info on the error
  // The following log fields hold this meta info
  ERROR_KIND: 'error.kind',
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

export const LOG_EVENTS = {
  // Request headers on the incoming request or
  // outgoing requests on clients
  REQUEST_HEADERS: 'request-headers',

  // Outgoing response headers on the server
  // or incoming request headers on clients
  RESPONSE_HEADERS: 'response-headers',

  // Incoming request on the server or
  // the outgoing request on clients was aborted
  REQUEST_ABORTED: 'request-aborted',

  // Incoming request on the server finished running all middlewares
  // However the response streaming may be still running 
  REQUEST_MIDDLEWARES_FINISHED: 'request-middlewares-finished',
}
