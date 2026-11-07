import { CIRCULAR, REDACTED, TRUNCATED, UNSERIALIZABLE } from './redactionMarkers'
import { isKnownCredentialHeaderName } from './sensitiveHeaders'

export { CIRCULAR, REDACTED, TRUNCATED, UNSERIALIZABLE }

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

/**
 * Replaces only the given secrets (the tokens of the request), wherever they appear. No pattern is
 * applied, so a text that merely looks like a credential (`Bearer …`, `Cookie: …`) is kept.
 *
 * Use it where the text may be an ordinary payload, such as a successful string body.
 */
export const redactKnownSecrets = (text: string, secrets: Array<string | undefined> = []): RedactResult => {
  const known = redactKnown(text, secrets)
  return { redacted: known.redacted, value: known.redacted > 0 ? known.value : text }
}

const MAX_DEEP_DEPTH = 32

const isPlainContainer = (value: unknown): value is Record<string, unknown> | unknown[] => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  if (Array.isArray(value)) {
    return true
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

// Whether `JSON.stringify` would not serialize the value as its own enumerable properties: a
// class instance (`Date`, `Buffer`, a DTO…) or an object with a `toJSON`, own or inherited.
const hasOwnSerialization = (node: object) =>
  !isPlainContainer(node) || typeof (node as any).toJSON === 'function'
    || Object.keys(node).some(key => {
      const descriptor = Object.getOwnPropertyDescriptor(node, key)
      return !!descriptor && !('value' in descriptor)
    })

// How `JSON.stringify` serializes a value: by its own enumerable properties (`plain`), by itself
// (`own`, see `hasOwnSerialization`), or not at all because inspecting it throws (`failed`).
const serializationOf = (node: object): 'plain' | 'own' | 'failed' => {
  try {
    return hasOwnSerialization(node) ? 'own' : 'plain'
  } catch {
    return 'failed'
  }
}

const shallowCopy = (node: Record<string, unknown> | unknown[]) => Array.isArray(node) ? node.slice() : { ...node }

// Sets a redacted child on a copy. A `toJSON` that returned undefined leaves an object key out, as
// JSON.stringify does; in an array it stays undefined, which JSON.stringify sends as null.
const assignChild = (copy: any, key: string, value: unknown) => {
  if (value === undefined && !Array.isArray(copy)) {
    delete copy[key]
  } else {
    copy[key] = value
  }
}

/**
 * Replaces the given secrets in every string of a value as `JSON.stringify` will send it, with
 * copy-on-write: plain objects and arrays without a secret keep their reference, and the received
 * value is not changed.
 *
 * A value that serializes itself (a class instance, or an object with a `toJSON`) is replaced by
 * what `JSON.stringify` makes of it, then inspected: otherwise its serialization would run after
 * the walk, unchecked. If that serialization fails, the value is replaced by `[Unserializable]`.
 * A container nested deeper than 32 levels is replaced by `[Truncated]`. Both are counted. A
 * reference back to a containing object is replaced by `[Circular]`, as `cleanError` does.
 *
 * Inside an object under a `headers` key, as in a serialized request config, the value of a known
 * credential header (`authorization`, `cookie`, `x-vtex-api-apptoken`, `VtexIdclientAutCookie…`) is
 * replaced whole, even when it is not one of the given secrets. Field names elsewhere are not
 * inspected, so business fields such as `key`, `session` or a session namespace called `cookie`
 * are kept.
 *
 * Without a usable secret the value is returned as it is.
 *
 * It is for error output (GraphQL `errors[]`, the body built from a thrown value), not for
 * successful responses, where dropping or reshaping data would not be acceptable.
 */
export const redactKnownSecretsDeep = <T>(value: T, secrets: Array<string | undefined> = []): { value: T, redacted: number, truncated: number, unserializable: number } => {
  const usable = secrets.filter((secret): secret is string => !!secret && secret.length >= MIN_SECRET_LENGTH)
  if (usable.length === 0) {
    return { redacted: 0, truncated: 0, unserializable: 0, value }
  }
  let redacted = 0
  let truncated = 0
  let unserializable = 0
  const seen = new Set<object>()

  // The plain JSON value `JSON.stringify` would send for a value that serializes itself. It is
  // serialized under the key it has in its parent, because `toJSON(key)` receives that key (an
  // object key, an array index as a string, or "" at the root). A `toJSON` that returns undefined
  // leaves the key out, as `JSON.stringify` does in the parent.
  const materialize = (node: object, depth: number, key: string): any => {
    let json: unknown
    try {
      json = (JSON.parse(JSON.stringify({ [key]: node })) as Record<string, unknown>)[key]
    } catch {
      unserializable++
      return UNSERIALIZABLE
    }
    return visit(json, depth, key)
  }

  const visitString = (text: string) => {
    const result = redactKnown(text, usable)
    redacted += result.redacted
    return result.redacted > 0 ? result.value : text
  }

  // The whole value of a known credential header. Undefined means the field is not one, so the
  // caller inspects the value. Null and a value already replaced are left as they are.
  const redactCredentialField = (key: string, child: unknown): string | undefined => {
    if (child == null || child === REDACTED || !isKnownCredentialHeaderName(key)) {
      return undefined
    }
    redacted++
    return REDACTED
  }

  const writeChild = (copy: any, node: any, key: string, safe: unknown, child: unknown) => {
    if (safe === child) {
      return copy
    }
    const target = copy === node ? shallowCopy(node) : copy
    assignChild(target, key, safe)
    return target
  }

  // Copy-on-write walk of a plain object or array. `key` is the one it has in its parent: only the
  // keys of a `headers` object are header names.
  const walk = (node: Record<string, unknown> | unknown[], depth: number, key: string) => {
    seen.add(node)
    let copy: any = node
    const keysAreHeaderNames = !Array.isArray(node) && key.toLowerCase() === 'headers'
    for (const childKey of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[childKey]
      const replaced = keysAreHeaderNames ? redactCredentialField(childKey, child) : undefined
      const safe = replaced === undefined ? visit(child, depth + 1, childKey) : replaced
      copy = writeChild(copy, node, childKey, safe, child)
    }
    seen.delete(node)
    return copy
  }

  const visit = (node: any, depth: number, key: string): any => {
    if (typeof node === 'string') {
      return visitString(node)
    }
    if (node === null || typeof node !== 'object') {
      return node
    }
    if (seen.has(node)) {
      // A cycle: the reference would keep the original, unredacted, and JSON.stringify would throw.
      return CIRCULAR
    }
    if (depth > MAX_DEEP_DEPTH) {
      truncated++
      return TRUNCATED
    }
    const serialization = serializationOf(node)
    if (serialization === 'failed') {
      // A `toJSON` getter that throws: JSON.stringify would throw too.
      unserializable++
      return UNSERIALIZABLE
    }
    return serialization === 'own' ? materialize(node, depth, key) : walk(node, depth, key)
  }

  const sanitized = visit(value, 0, '')
  return { redacted, truncated, unserializable, value: sanitized }
}
