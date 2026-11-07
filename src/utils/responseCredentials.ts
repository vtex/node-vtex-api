import { isSensitiveKey, REDACTED, redactSecrets } from './stringRedactor'

// Bound work before serializing a response. Unlike error-only inspection, reaching these limits
// must withhold the response: the unvisited portion may contain a serialized credential.
const MAX_DEPTH = 32
const MAX_VALUES = 5000000
const MAX_TEXT_LENGTH = 16 * 1024 * 1024

/**
 * Copy-on-write redaction for JSON response values, including already serialized Axios errors
 * and GraphQL messages. Does not mutate cached/frozen values. Throws if inspection cannot finish.
 * Buffers and streams are handled separately by the HTTP middleware and are outside this contract.
 */
export const sanitizeCredentials = <T>(body: T, secrets: Array<string | undefined> = []) => {
  let values = 0
  let textLength = 0
  let redacted = 0
  const ancestors = new Set<object>()

  const visit = (value: any, depth: number): any => {
    if (++values > MAX_VALUES || depth > MAX_DEPTH) {
      throw new Error('Response credential inspection limit reached')
    }
    if (typeof value === 'string') {
      textLength += value.length
      if (textLength > MAX_TEXT_LENGTH) {
        throw new Error('Response credential text limit reached')
      }
      const redaction = redactSecrets(value, secrets)
      redacted += redaction.redacted
      return redaction.value
    }
    if (value === null || typeof value !== 'object') {
      return value
    }
    // Dates serialize to a credential-free ISO string. Other custom serialization cannot be
    // inspected reliably without executing it; withhold it instead of sending unchecked output.
    if (value instanceof Date) {
      if (value.toJSON !== Date.prototype.toJSON) {
        throw new Error('Custom date serialization in response')
      }
      return value
    }
    if (ancestors.has(value) || typeof value.toJSON === 'function') {
      throw new Error('Uninspectable response serialization')
    }
    const proto = Object.getPrototypeOf(value)
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
      throw new Error('Uninspectable response object')
    }
    const keys = Object.keys(value)
    if (values + keys.length > MAX_VALUES) {
      throw new Error('Response credential inspection limit reached')
    }
    ancestors.add(value)
    let result = value
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (!('value' in descriptor)) {
        throw new Error('Response accessor cannot be safely inspected')
      }
      const child = descriptor.value
      const sensitive = isSensitiveKey(key) && child != null && child !== REDACTED
      const safe = sensitive ? REDACTED : visit(child, depth + 1)
      if (sensitive) { redacted++ }
      if (safe !== child) {
        result = result === value ? (Array.isArray(value) ? value.slice() : { ...value }) : result
        Object.defineProperty(result, key, { configurable: true, enumerable: true, value: safe, writable: true })
      }
    }
    ancestors.delete(value)
    return result
  }

  const sanitized = visit(body, 0) as T
  return { redacted, value: sanitized }
}
