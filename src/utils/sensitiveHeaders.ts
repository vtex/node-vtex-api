import { REDACTED, TRUNCATED } from './stringRedactor'

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

const MAX_CREDENTIAL_DEPTH = 32

const isStream = (value: any) => value != null && typeof value.pipe === 'function'

const shallowCopy = (value: Record<string, any>) => Array.isArray(value) ? value.slice() : { ...value }

// The value of one field: replaced when an object key names a credential, inspected otherwise.
// Array indexes are not names, so array items are always inspected.
const redactField = (container: Record<string, any>, name: string, value: unknown, depth: number): unknown =>
  !Array.isArray(container) && isSensitiveParamName(name) && value != null
    ? REDACTED
    : redactCredentialFields(value, depth + 1)

/**
 * A copy of an object or array with the value of every credential-named key replaced, at any
 * depth (`filter.appToken`, `list[].apiKey`). Copy-on-write: what has nothing to replace keeps
 * its reference. Beyond 32 levels a nested container becomes `[Truncated]` instead of being sent
 * uninspected. A string, buffer or stream is returned as it is.
 */
export const redactCredentialFields = (value: unknown, depth = 0): unknown => {
  if (value === null || typeof value !== 'object' || Buffer.isBuffer(value) || isStream(value)) {
    return value
  }
  if (depth > MAX_CREDENTIAL_DEPTH) {
    return TRUNCATED
  }
  let copy: any = value
  for (const name of Object.keys(value as Record<string, any>)) {
    const child = (value as Record<string, any>)[name]
    const safe = redactField(value as Record<string, any>, name, child, depth)
    if (safe !== child) {
      copy = copy === value ? shallowCopy(value as Record<string, any>) : copy
      copy[name] = safe
    }
  }
  return copy
}

/**
 * The request body (`config.data`). An object is scrubbed like `params`. The client also stores
 * the body as the JSON text it sent, so that text is parsed, scrubbed and written back. Plain
 * text, a buffer and a stream are returned as they are.
 */
export const redactRequestData = (data: unknown): unknown => {
  if (typeof data !== 'string') {
    return redactCredentialFields(data)
  }
  const first = /\S/.exec(data)
  if (!first || (first[0] !== '{' && first[0] !== '[')) {
    return data
  }
  try {
    const parsed = JSON.parse(data)
    const redacted = redactCredentialFields(parsed)
    return redacted === parsed ? data : JSON.stringify(redacted)
  } catch {
    return data
  }
}

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
