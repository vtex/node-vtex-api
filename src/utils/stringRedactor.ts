import { REDACTED, TRUNCATED } from './redaction'
import { isCredentialPayloadFieldName } from './sensitiveHeaders'

// Shorter values are not credentials, and replacing them everywhere would damage ordinary text.
const MIN_SECRET_LENGTH = 16

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

/**
 * What replaces a value whose serialization failed. Fail closed: what could not be inspected is
 * not sent.
 */
export const UNSERIALIZABLE = '[Unserializable]'

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
 * A container nested deeper than 32 levels is replaced by `[Truncated]`. Both are counted.
 *
 * The value of a credential-named field (`password`, `authorization`, `appToken`…) is replaced whole,
 * even when it is not one of the given secrets. Array indexes are not names.
 *
 * It is for error output (GraphQL `errors[]`, the body built from a thrown value), not for
 * successful responses, where dropping or reshaping data would not be acceptable.
 */
export const redactKnownSecretsDeep = <T>(value: T, secrets: Array<string | undefined> = []): { value: T, redacted: number, truncated: number, unserializable: number } => {
  const usable = secrets.filter((secret): secret is string => !!secret && secret.length >= MIN_SECRET_LENGTH)
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

  // The whole value of a credential-named field. Undefined means the field is not one, so the
  // caller inspects the value. Null and a value already replaced are left as they are.
  const redactCredentialField = (key: string, child: unknown): string | undefined => {
    if (child == null || child === REDACTED || !isCredentialPayloadFieldName(key)) {
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

  // Copy-on-write walk of a plain object or array.
  const walk = (node: Record<string, unknown> | unknown[], depth: number) => {
    seen.add(node)
    let copy: any = node
    const keysAreNames = !Array.isArray(node)
    for (const childKey of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[childKey]
      const replaced = keysAreNames ? redactCredentialField(childKey, child) : undefined
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
    if (node === null || typeof node !== 'object' || seen.has(node)) {
      return node
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
    return serialization === 'own' ? materialize(node, depth, key) : walk(node, depth)
  }

  const sanitized = visit(value, 0, '')
  return { redacted, truncated, unserializable, value: sanitized }
}
