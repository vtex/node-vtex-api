export const REDACTED = '[Redacted]'

// Shorter values are not credentials, and replacing them everywhere would damage ordinary text.
const MIN_SECRET_LENGTH = 16

/**
 * Names under which credentials travel in HTTP headers. When an error is turned into text with
 * `JSON.stringify`, its request config, and the headers in it, end up in the text under these keys.
 */
const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'proxy-authorization',
  'vtexidclientautcookie',
  'x-vtex-api-appkey',
  'x-vtex-api-apptoken',
  'x-vtex-credential',
  'x-vtex-session',
]

const sensitiveKeys = new Set(SENSITIVE_KEYS)
export const isSensitiveKey = (key: string) => sensitiveKeys.has(key.toLowerCase())

// `"key":"value"`, also when the text was serialized twice (`\"key\":\"value\"`). Captures
// everything up to the value, which is what is replaced. The value is a run of characters that are
// not a quote, where a backslash only escapes the character after it. The two alternatives of the
// run exclude each other, so the match is linear.
const KEYED_VALUE = new RegExp(
  String.raw`(\\{0,2}"(?:${SENSITIVE_KEYS.join('|')})\\{0,2}"\s*:\s*\\{0,2}")(?:[^"\\]|\\[^"])+`,
  'gi'
)

// A header written as a line of the request (`Proxy-Authorization: value`), which is how a
// serialized request object (`_header`) holds it. Short values are not credentials. `Cookie` is
// not in this list: the word opens ordinary sentences, so its lines are matched separately.
const HEADER_LINE_NAMES = [
  'authorization',
  'proxy-authorization',
  'vtexidclientautcookie',
  'x-vtex-api-appkey',
  'x-vtex-api-apptoken',
  'x-vtex-credential',
  'x-vtex-session',
]
// The name starts a line. In a serialized request the line break is the two characters `\n`, so a
// word boundary never fires there: the `n` and the name are both word characters.
const AT_LINE_START = String.raw`(?<=^|\\n|\\r|\n|\r)`

const HEADER_LINE = new RegExp(
  String.raw`${AT_LINE_START}((?:${HEADER_LINE_NAMES.join('|')})[ \t]*:[ \t]*)[^\s"\\][^\r\n"\\]{7,}`,
  'gi'
)

// A `Cookie` or `Set-Cookie` line. The value has to be cookie pairs (`name=value`), so a sentence
// that happens to start with "Cookie:" is left as it is.
const COOKIE_LINE = new RegExp(
  String.raw`${AT_LINE_START}((?:set-)?cookie[ \t]*:[ \t]*)[^\s=;"\\]+=[^\r\n"\\]{6,}`,
  'gi'
)

// The VTEX ID cookie, in a `Cookie` header or a `Set-Cookie` line.
const VTEX_ID_COOKIE = /\b(VtexIdclientAutCookie(?:_[a-z0-9-]+)?=)[^;\s"\\]+/gi

// An `Authorization` value that is not under a key, as in a message or a copied header line.
const BEARER_TOKEN = /\b(Bearer\s+)[a-z0-9._~+/=-]{16,}/gi

export interface RedactResult {
  value: string
  /**
   * How many occurrences were replaced. Zero means `value` is the received string.
   */
  redacted: number
}

const redactKnown = (text: string, secrets: Array<string | undefined>): RedactResult => {
  let value = text
  let redacted = 0
  for (const secret of secrets) {
    if (!secret || secret.length < MIN_SECRET_LENGTH || !value.includes(secret)) {
      continue
    }
    const parts = value.split(secret)
    redacted += parts.length - 1
    value = parts.join(REDACTED)
  }
  return { redacted, value }
}

const redactPattern = (text: string, pattern: RegExp): RedactResult => {
  let redacted = 0
  const value = text.replace(pattern, (match: string, prefix: string) => {
    if (match === `${prefix}${REDACTED}`) {
      return match
    }
    redacted++
    return `${prefix}${REDACTED}`
  })
  return { redacted, value: redacted > 0 ? value : text }
}

/**
 * Replaces credentials in a text: the given secrets wherever they appear, the value of the
 * credential headers in JSON text and in header lines, `Cookie` and `Set-Cookie` lines, the VTEX
 * ID cookie, and `Bearer` tokens.
 * The rest of the text is kept.
 *
 * It is for text that was built from an error, where the error object is no longer there to
 * detect. It does not inspect anything else: a credential that is neither one of the secrets nor
 * under one of those names is not found.
 */
export const redactSecrets = (text: string, secrets: Array<string | undefined> = []): RedactResult => {
  const known = redactKnown(text, secrets)
  let value = known.value
  let redacted = known.redacted
  for (const pattern of [KEYED_VALUE, HEADER_LINE, COOKIE_LINE, VTEX_ID_COOKIE, BEARER_TOKEN]) {
    const result = redactPattern(value, pattern)
    value = result.value
    redacted += result.redacted
  }

  return { redacted, value: redacted > 0 ? value : text }
}
