export const REDACTED = '[Redacted]'

/**
 * What replaces a container nested deeper than the walk inspects. It is not sent as it is: what
 * was not inspected could hold a secret.
 */
export const TRUNCATED = '[Truncated]'
