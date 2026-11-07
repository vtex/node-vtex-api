import { REDACTED } from './stringRedactor'

/**
 * Names under which credentials travel in HTTP headers, lower-case. Shared by the `HttpClient`
 * error sanitizer and by `cleanError`, so what is logged and what reaches app code agree.
 */
export const SENSITIVE_HEADER_KEYS: ReadonlyArray<string> = [
  'authorization',
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'x-vtex-api-appkey',
  'x-vtex-api-apptoken',
  'x-vtex-credential',
  'x-vtex-session',
]

// The store cookie carries the account in its name (`VtexIdclientAutCookie_<account>`), which an
// exact match misses.
const SENSITIVE_HEADER_PREFIXES: ReadonlyArray<string> = ['vtexidclientautcookie']

// Third-party credentials have no fixed name. A header whose name looks like one is treated as one.
const SENSITIVE_NAME_PATTERN = /auth|token|key|secret|cookie|credential|session|password/i

const sensitiveHeaderKeys = new Set(SENSITIVE_HEADER_KEYS)

/**
 * Whether a header is one of the known credential headers: a name in `SENSITIVE_HEADER_KEYS`, or
 * the VTEX ID cookie with or without the account suffix. No name pattern is applied.
 *
 * Use it for headers of an upstream response, which only carry a credential back through
 * `set-cookie`: a pattern would also hide ordinary headers apps read, such as `www-authenticate`.
 */
export const isKnownCredentialHeaderName = (name: string): boolean => {
  const lower = name.toLowerCase()
  return sensitiveHeaderKeys.has(lower) || SENSITIVE_HEADER_PREFIXES.some(prefix => lower.startsWith(prefix))
}

/**
 * Whether a header with this name carries a credential: a known name, the VTEX ID cookie with or
 * without the account suffix, or a name that looks like a credential.
 *
 * Use it for headers the app sent, where third-party credentials have no fixed name.
 */
export const isSensitiveHeaderName = (name: string): boolean =>
  isKnownCredentialHeaderName(name) || SENSITIVE_NAME_PATTERN.test(name)

/**
 * Whether a query string or `params` key carries a credential (`appToken`, `api_key`, `sessionId`…).
 */
export const isSensitiveParamName = (name: string): boolean => SENSITIVE_NAME_PATTERN.test(name)

const safeDecode = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * Replaces the value of credential-named keys in the query of a URL or request path, keeping the
 * rest as written. Encoded and nested keys are recognized (`filter%5BappToken%5D=…`), since that is
 * how the client serializes nested params. Non-strings are returned as they are.
 */
export const redactUrlQuery = (url: unknown) => {
  if (typeof url !== 'string') {
    return url
  }
  const safeUrl = url.replace(/^((?:[a-z][a-z\d+.-]*:)?\/\/)[^/?#]*@/i, `$1${REDACTED}@`)
  const queryStart = safeUrl.indexOf('?')
  if (queryStart === -1) {
    return safeUrl
  }
  const hashStart = safeUrl.indexOf('#', queryStart)
  const queryEnd = hashStart === -1 ? safeUrl.length : hashStart
  const query = safeUrl.slice(queryStart + 1, queryEnd)
  const redactedQuery = query
    .split('&')
    .map(pair => {
      const separator = pair.indexOf('=')
      const name = separator === -1 ? pair : pair.slice(0, separator)
      return separator !== -1 && isSensitiveParamName(safeDecode(name)) ? `${name}=${REDACTED}` : pair
    })
    .join('&')
  return redactedQuery === query ? safeUrl : `${safeUrl.slice(0, queryStart + 1)}${redactedQuery}${safeUrl.slice(queryEnd)}`
}
