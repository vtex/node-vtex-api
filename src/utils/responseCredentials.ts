import { isSensitiveKey, REDACTED, redactSecrets } from './stringRedactor'

// Bound work before serializing a response. Preserve the existing limit behavior: leave
// unvisited values untouched and report truncation instead of withholding the response.
const MAX_DEPTH = 32
const MAX_VALUES = 5000000
const MAX_TEXT_LENGTH = 16 * 1024 * 1024

type InspectionReason = 'cycle' | 'custom_serialization' | 'custom_date_serialization' | 'unsupported_object' | 'accessor'

export class ResponseInspectionError extends Error {
  constructor(public readonly reason: InspectionReason) {
    super('Response inspection failed')
  }
}

// Fixed categories only: never include response values or arbitrary exception messages in diagnostics.
export const inspectionFailureReason = (error: unknown): string =>
  error instanceof ResponseInspectionError ? error.reason : 'unexpected_failure'

/**
 * Copy-on-write redaction for JSON response values, including already serialized Axios errors
 * and GraphQL messages. Does not mutate cached/frozen values. Limits preserve unvisited values;
 * unexpected inspection failures still throw.
 * Unknown secrets in name/value header pairs are not recognized as credential fields.
 * Buffers and streams are handled separately by the HTTP middleware and are outside this contract.
 */
export const sanitizeCredentials = <T>(body: T, secrets: (string | undefined)[] = []) => {
  let values = 0
  let textLength = 0
  let redacted = 0
  let truncated = false
  const ancestors = new Set<object>()

  const visit = (value: any, depth: number): any => {
    if (++values > MAX_VALUES || depth > MAX_DEPTH) {
      truncated = true
      return value
    }
    if (typeof value === 'string') {
      textLength += value.length
      if (textLength > MAX_TEXT_LENGTH) {
        truncated = true
        return value
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
        throw new ResponseInspectionError('custom_date_serialization')
      }
      return value
    }
    if (ancestors.has(value)) {
      throw new ResponseInspectionError('cycle')
    }
    if (typeof value.toJSON === 'function') {
      throw new ResponseInspectionError('custom_serialization')
    }
    const proto = Object.getPrototypeOf(value)
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
      throw new ResponseInspectionError('unsupported_object')
    }
    const keys = Object.keys(value)
    if (values + keys.length > MAX_VALUES) {
      truncated = true
      return value
    }
    ancestors.add(value)
    let result = value
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (!('value' in descriptor)) {
        throw new ResponseInspectionError('accessor')
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
  return { redacted, truncated, value: sanitized }
}
