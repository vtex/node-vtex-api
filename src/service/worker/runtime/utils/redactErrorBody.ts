import { redactKnownSecretsDeep } from '../../../../utils/stringRedactor'
import { IOContext } from '../typings'

/**
 * How long the redaction of an error body may take before it is reported. The walk has no budget,
 * so that no error body is ever cut; a slow one is logged instead.
 */
export const SLOW_ERROR_REDACTION_MS = 50

const elapsedMs = (start: [number, number]) => {
  const [seconds, nanoseconds] = process.hrtime(start)
  return seconds * 1e3 + nanoseconds / 1e6
}

/**
 * The body of an error response (REST body built from a thrown value, GraphQL `errors[]`) with the
 * tokens of the request and the known credential headers replaced. See `redactKnownSecretsDeep`.
 * A redaction slower than `SLOW_ERROR_REDACTION_MS` is logged as a warning, with its duration only.
 */
export const redactErrorBody = <T>(value: T, vtex: Partial<IOContext> | undefined): T => {
  const { adminUserAuthToken, authToken, logger, storeUserAuthToken } = vtex ?? {}
  const start = process.hrtime()
  const { value: safe } = redactKnownSecretsDeep(value, [authToken, adminUserAuthToken, storeUserAuthToken])
  const durationMs = elapsedMs(start)
  if (durationMs > SLOW_ERROR_REDACTION_MS) {
    try {
      logger?.warn({ durationMs: Math.round(durationMs), message: 'error-redaction: slow' })
    } catch {
      // Logging must not change the response.
    }
  }
  return safe
}
