import { LINKED } from '../../../../../constants'
import { sanitizeErrors, scanForErrors } from '../../../../../utils/responseSanitizer'
import { redactKnownSecrets } from '../../../../../utils/stringRedactor'
import { ServiceContext } from '../../typings'

/**
 * Setting this environment variable to `off` disables the sanitizer.
 */
export const RESPONSE_SANITIZER_SWITCH = 'VTEX_IO_RESPONSE_SANITIZER'

/**
 * Sent when the body could not be sanitized: it is not known whether it is safe, so it is withheld.
 */
export const WITHHELD_BODY = {
  code: 'E_RESPONSE_WITHHELD',
  message: 'The response could not be safely returned.',
}

export enum SanitizerReason {
  ErrorRemoved = 'error_object_removed',
  SecretRemoved = 'secret_removed',
  LimitReached = 'limit_reached',
  Failed = 'sanitizer_failed',
}

// Only the class of the error is reported: its message may carry what is being kept out.
const errorName = (err: unknown) => (err as Error | undefined)?.name

const warn = (ctx: ServiceContext, reason: SanitizerReason, fields: Record<string, any> = {}) => {
  const payload = {
    message: `response-sanitizer: ${reason}`,
    reason,
    routeId: ctx.vtex?.route?.id,
    ...fields,
  }
  try {
    if (ctx.vtex?.logger) {
      ctx.vtex.logger.warn(payload)
    } else {
      console.warn(JSON.stringify(payload))
    }
  } catch (err) {
    // Logging must never break the response: the event goes to the process output instead.
    console.warn(JSON.stringify({ ...payload, loggerErrorName: errorName(err) }))
  }
}

const withholdBody = (ctx: ServiceContext) => {
  try {
    if (ctx.status < 400) {
      ctx.status = 500
    }
    ctx.body = WITHHELD_BODY
  } catch (err) {
    // There is nothing else that can be done safely: as a last resort the response is emptied.
    ctx.body = null
    warn(ctx, SanitizerReason.Failed, { withholdErrorName: errorName(err) })
  }
}

// A string body can hold an error that was turned into text (`JSON.stringify(error)`), which has
// no error object left to find. What can be told apart is the credential itself. Only the tokens
// of the request are replaced: a successful body may legitimately contain text that looks like a
// credential (`Bearer …`, `Cookie: …`), and the HttpClient already masks its errors at the origin.
const redactStringBody = (ctx: ServiceContext, body: string) => {
  const { authToken, adminUserAuthToken, storeUserAuthToken } = ctx.vtex ?? {}
  const { value, redacted } = redactKnownSecrets(body, [authToken, adminUserAuthToken, storeUserAuthToken])
  if (redacted === 0) {
    return
  }

  // Koa keeps the type already set when the body is a string, and updates the length.
  ctx.body = value
  warn(ctx, SanitizerReason.SecretRemoved, { redactions: redacted })
}

const sanitizeCtxBody = (ctx: ServiceContext) => {
  try {
    if (process.env[RESPONSE_SANITIZER_SWITCH] === 'off') {
      return
    }

    const body = ctx.body
    if (typeof body === 'string') {
      redactStringBody(ctx, body)
      return
    }
    if (body === null || typeof body !== 'object' || Buffer.isBuffer(body) || typeof body.pipe === 'function') {
      return
    }

    // Most bodies have no error. A scan decides that without the copying walk; the walk runs only
    // once an error has been found, or the scan could not finish.
    const scan = scanForErrors(body)
    if (scan === 'clean') {
      return
    }

    const { value, replaced, truncated } = sanitizeErrors(body, { linked: LINKED })

    if (truncated) {
      // What is beyond the limit is left as it is, outside an error. The response is still sent:
      // withholding it would break the large legitimate responses. It is reported to be measured.
      warn(ctx, SanitizerReason.LimitReached)
    }

    if (value === body) {
      return
    }

    // Koa sets `Content-Type: application/json` whenever an object is assigned to the body, which
    // would override a type chosen by the app.
    const contentType = ctx.response.get('Content-Type')
    ctx.body = value
    if (contentType) {
      ctx.set('Content-Type', contentType)
    }

    // The scan also runs the walk when it could not finish. That walk may replace nothing, so a
    // removal is reported only when one actually happened.
    if (replaced > 0) {
      warn(ctx, SanitizerReason.ErrorRemoved, { errors: replaced })
    }
  } catch (err) {
    // Fails closed: whatever made it fail may also be hiding a credential.
    withholdBody(ctx)
    warn(ctx, SanitizerReason.Failed, { errorName: errorName(err) })
  }
}

/**
 * Removes error objects (`Error`, `AxiosError`) from the response body, so apps that write a caught
 * error to `ctx.body` do not expose the request configuration (credentials), the stack and the
 * connection internals to the caller.
 *
 * String bodies are also covered, for errors that were turned into text: the credentials in them
 * (the ones of the request, the credential headers, `Bearer` tokens) are replaced.
 *
 * It must be registered after `compress()`, which serializes the body: it needs to see the object,
 * and to change it before it is serialized.
 *
 * The body is also sanitized when the downstream handlers throw after having set it, as the error
 * middleware keeps an existing body. If the sanitizer itself fails the body is withheld. If it
 * cannot inspect the whole body, the response is sent and the limit is reported. It never throws.
 *
 * It is a backstop for apps that return errors by mistake. It is not a boundary against an app that
 * wants to disclose its own credentials, which has them.
 */
export async function sanitizeResponse(ctx: ServiceContext, next: () => Promise<void>) {
  try {
    await next()
  } finally {
    sanitizeCtxBody(ctx)
  }
}
