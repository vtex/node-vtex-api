// The markers that replace what the redactors remove. They live apart from the redactors so that
// `stringRedactor` and `sensitiveHeaders` both depend on them without depending on each other.

/**
 * What replaces a credential.
 */
export const REDACTED = '[Redacted]'

/**
 * What replaces a container nested deeper than a walk inspects. It is not sent as it is: what was
 * not inspected could hold a secret.
 */
export const TRUNCATED = '[Truncated]'

/**
 * What replaces a value whose serialization failed. Fail closed: what could not be inspected is
 * not sent.
 */
export const UNSERIALIZABLE = '[Unserializable]'

/**
 * What replaces a reference back to an object that contains it. The reference would point to the
 * original, not to the redacted copy, and JSON.stringify cannot send a cycle.
 */
export const CIRCULAR = '[Circular]'
