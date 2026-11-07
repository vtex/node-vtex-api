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
 * Whether a header with this name carries a credential: a known name, the VTEX ID cookie with or
 * without the account suffix, or a name that looks like a credential.
 */
export const isSensitiveHeaderName = (name: string): boolean => {
  const lower = name.toLowerCase()
  return sensitiveHeaderKeys.has(lower)
    || SENSITIVE_HEADER_PREFIXES.some(prefix => lower.startsWith(prefix))
    || SENSITIVE_NAME_PATTERN.test(lower)
}

/**
 * Whether a query string or `params` key carries a credential (`appToken`, `api_key`, `sessionId`…).
 */
export const isSensitiveParamName = (name: string): boolean => SENSITIVE_NAME_PATTERN.test(name)
