import { REDACTED, TRUNCATED, UNSERIALIZABLE } from './redactionMarkers'

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

const isStream = (value: object) => typeof (value as { pipe?: unknown }).pipe === 'function'

const shallowCopy = (value: Record<string, any>) => Array.isArray(value) ? value.slice() : { ...value }

// The value of one field: replaced when an object key names a credential, inspected otherwise.
// Array indexes are not names, so array items are always inspected.
const redactField = (container: Record<string, any>, name: string, value: unknown, depth: number): unknown =>
  !Array.isArray(container) && isSensitiveParamName(name) && value != null
    ? REDACTED
    : redactCredentialFields(value, depth + 1)

// What JSON.stringify sends for a value with its own serialization (`toJSON`, own or inherited), as
// plain JSON. A copy would keep the `toJSON`, which would serialize the original values again.
const materialize = (value: object): unknown => {
  try {
    return JSON.parse(JSON.stringify(value) ?? 'null')
  } catch {
    return UNSERIALIZABLE
  }
}

/**
 * A copy of an object or array with the value of every credential-named key replaced, at any
 * depth (`filter.appToken`, `list[].apiKey`). Copy-on-write: what has nothing to replace keeps
 * its reference. A value with a `toJSON` is replaced by what it serializes to, then inspected.
 * Beyond 32 levels a nested container becomes `[Truncated]` instead of being sent uninspected. A
 * string, buffer or stream is returned as it is.
 */
export const redactCredentialFields = (value: unknown, depth = 0): unknown => {
  if (value === null || typeof value !== 'object' || Buffer.isBuffer(value) || isStream(value)) {
    return value
  }
  if (depth > MAX_CREDENTIAL_DEPTH) {
    return TRUNCATED
  }
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return redactCredentialFields(materialize(value), depth)
  }
  let copy: any = value
  for (const name of Object.keys(value)) {
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
 * the body as the text it sent: JSON text is parsed, scrubbed and written back, and a form body
 * (`application/x-www-form-urlencoded`, `appToken=…&name=…`) has its credential-named values
 * replaced like a URL query. Other text, a buffer and a stream are returned as they are.
 */
export const redactRequestData = (data: unknown): unknown => {
  if (typeof data !== 'string') {
    return redactCredentialFields(data)
  }
  const first = /\S/.exec(data)
  if (!first) {
    return data
  }
  if (first[0] !== '{' && first[0] !== '[') {
    return isFormBody(data) ? redactQueryString(data) : data
  }
  try {
    const parsed = JSON.parse(data)
    const redacted = redactCredentialFields(parsed)
    return redacted === parsed ? data : JSON.stringify(redacted)
  } catch {
    return data
  }
}

// Form-encoded text: `name=value` pairs joined by `&`, with no whitespace (the encoding has none).
const isFormBody = (text: string) => text.includes('=') && !/\s/.test(text)

const SCHEME = /^[a-z][a-z\d+.-]*:/i
// Schemes whose authority the URL parser finds with fewer than two separators (`http:/user@host`,
// `http:user@host`). Other schemes need `//`: `mailto:someone@host` has no user info.
const SPECIAL_SCHEMES = new Set(['ftp:', 'http:', 'https:', 'ws:', 'wss:'])
const AUTHORITY_END = /[\\/?#]/

const isSeparator = (char: string | undefined) => char === '/' || char === '\\'

// Where the authority (`user:password@host`) of a URL starts, in the forms the URL parser accepts:
// leading whitespace, `/` or `\\` separators, and a special scheme with fewer separators. -1 when
// the URL has no authority (a path, a relative reference, `mailto:`).
const authorityStart = (url: string) => {
  const start = url.length - url.replace(/^\s+/, '').length
  const scheme = SCHEME.exec(url.slice(start))?.[0] ?? ''
  let index = start + scheme.length
  const separatorsStart = index
  while (isSeparator(url[index])) {
    index++
  }
  const hasAuthority = SPECIAL_SCHEMES.has(scheme.toLowerCase()) || index - separatorsStart >= 2
  return hasAuthority ? index : -1
}

// The URL with its user info replaced, keeping the scheme, host and the rest as written.
const maskUserInfo = (url: string) => {
  const start = authorityStart(url)
  if (start === -1) {
    return url
  }
  const rest = url.slice(start)
  const end = AUTHORITY_END.exec(rest)
  const at = (end ? rest.slice(0, end.index) : rest).lastIndexOf('@')
  return at === -1 ? url : `${url.slice(0, start)}${REDACTED}${url.slice(start + at)}`
}

// The WHATWG URL parser, a global since Node 10. Read from `global` so no module import is needed;
// without it the safety net below is skipped.
type UrlParser = new (input: string) => { password: string, username: string }
const UrlParserClass: UrlParser | undefined = (global as any).URL

// Whether the URL parser still finds user info other than the redaction marker.
const keepsUserInfo = (url: string) => {
  if (!UrlParserClass) {
    return false
  }
  try {
    const { password, username } = new UrlParserClass(url)
    return !!password || (!!username && safeDecode(username) !== REDACTED)
  } catch {
    return false
  }
}

const safeDecode = (text: string) => {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return text
  }
}

// A query string or form body (`a=1&appToken=…`) with the value of credential-named keys replaced.
// Encoded and nested keys are recognized (`filter%5BappToken%5D=…`). Returns the same string when
// there is nothing to replace.
function redactQueryString (query: string): string {
  return query
    .split('&')
    .map(pair => {
      const separator = pair.indexOf('=')
      const name = separator === -1 ? pair : pair.slice(0, separator)
      return separator !== -1 && isSensitiveParamName(safeDecode(name)) ? `${name}=${REDACTED}` : pair
    })
    .join('&')
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
  const safeUrl = maskUserInfo(url)
  if (keepsUserInfo(safeUrl)) {
    // A form the pattern does not know still carries credentials: nothing of it is kept.
    return REDACTED
  }
  const queryStart = safeUrl.indexOf('?')
  if (queryStart === -1) {
    return safeUrl
  }
  const hashStart = safeUrl.indexOf('#', queryStart)
  const queryEnd = hashStart === -1 ? safeUrl.length : hashStart
  const query = safeUrl.slice(queryStart + 1, queryEnd)
  const redactedQuery = redactQueryString(query)
  return redactedQuery === query ? safeUrl : `${safeUrl.slice(0, queryStart + 1)}${redactedQuery}${safeUrl.slice(queryEnd)}`
}
