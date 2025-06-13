import { authFields, sanitizeAuth } from '@vtex/node-error-report'
import { Span } from 'opentracing'

export interface TraceInfo {
  traceId?: string
  isSampled: boolean
}

/**
 * Headers that are interesting for tracing and debugging purposes
 */
export const INTERESTING_HEADERS = [
  // Request/Response Identification & Routing
  'x-request-id',
  'x-correlation-id',
  'x-trace-id',
  'x-span-id',
  'x-forwarded-for',
  'x-real-ip',
  'host',
  'referer',
  
  // Content & Encoding
  'content-type',
  'content-length',
  'content-encoding',
  'accept',
  'accept-encoding',
  'accept-language',
  
  // Caching & Performance
  'cache-control',
  'etag',
  'if-none-match',
  'expires',
  'last-modified',
  
  // Client Information
  'user-agent',
  'x-forwarded-proto',
  'x-forwarded-host',
  'x-forwarded-port',
  
  // VTEX/E-commerce Specific (x-vtex-* headers are handled automatically)
  
  // API & Service Headers
  'x-api-version',
  'x-service-name',
  'x-timeout',
  'retry-after',
  
  // Security (will be sanitized)
  'authorization',
  'cookie',
]

export function getTraceInfo(span?: Span): TraceInfo {
  const spanContext = span?.context()
  return {
    isSampled: (spanContext as any)?.isSampled?.() ?? false,
    traceId: spanContext?.toTraceId(),
  }
}

/**
 * Do a shallow copy of a headers object and redacts sensitive information.
 * Only includes headers that are in the INTERESTING_HEADERS whitelist.
 *
 * @param headersObj The headers object
 * @param resultFieldsPrefix The prefix that will be added to each field on the result object
 */
export const cloneAndSanitizeHeaders = (headersObj: Record<string, any>, resultFieldsPrefix: string = '') => {
  const ret: Record<string, string> = {}
  const entries = Object.entries(headersObj)
  
  // Create a set of lowercase header names for case-insensitive matching
  const interestingHeadersSet = new Set(INTERESTING_HEADERS.map(h => h.toLowerCase()))
  
  for (const [key, val] of entries) {
    const lowerKey = key.toLowerCase()
    
    // Only include headers that are in our whitelist or start with x-vtex-
    if (!interestingHeadersSet.has(lowerKey) && !lowerKey.startsWith('x-vtex-')) {
      continue
    }
    
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
