import { Span } from 'opentracing'
import { authFields, sanitizeAuth } from '@vtex/node-error-report'

export interface TraceInfo {
  traceId: string
  isSampled: boolean
}

export function getTraceInfo(span: Span): TraceInfo {
  const spanContext = span.context()
  return {
    isSampled: (spanContext as any).isSampled?.() ?? false,
    traceId: spanContext.toTraceId(),
  }
}

/**
 * Do a shallow copy of a headers object and redacts sensitive information.
 *
 * @param headersObj The headers object
 * @param resultFieldsPrefix The prefix that will be added to each field on the result object
 */
export const cloneAndSanitizeHeaders = (headersObj: Record<string, any>, resultFieldsPrefix: string = '') => {
  const ret: Record<string, string> = {}
  const entries = Object.entries(headersObj)
  for (const [key, val] of entries) {
    // Most of the time val is a string, but there are some cases, for example when we do a axios interceptor,
    // that a header field can contain an object, for example:
    // ```
    // "common": {
    //   "Accept": "application/json, text/plain, */*"
    // },
    // "delete": { },
    // "get": { },
    // "head": { },
    // "post": {
    //   "Content-Type": "application/x-www-form-urlencoded"
    // },
    // ```
    // In those corner cases we probably won't have a sensitive string as key, so we don't treat them here
    ret[`${resultFieldsPrefix}${key}`] = authFields.includes(key) ? sanitizeAuth(val) : val
  }

  return ret
}
