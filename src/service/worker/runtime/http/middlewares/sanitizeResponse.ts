import { LINKED } from '../../../../../constants'
import { sanitizeErrors } from '../../../../../utils/responseSanitizer'
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

const sanitizeCtxBody = (ctx: ServiceContext) => {
  try {
    if (process.env[RESPONSE_SANITIZER_SWITCH] === 'off') {
      return
    }

    const body = ctx.body
    if (body === null || typeof body !== 'object' || Buffer.isBuffer(body) || typeof body.pipe === 'function') {
      return
    }

    const { value, replaced, truncated } = sanitizeErrors(body, { linked: LINKED })

    if (truncated) {
      // The part beyond the limit was not inspected. Withholding it would break the large legitimate
      // responses, so it is reported to be measured.
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

    warn(ctx, SanitizerReason.ErrorRemoved, { errors: replaced })
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
 * It must be registered after `compress()`, which serializes the body: it needs to see the object,
 * and to change it before it is serialized.
 *
 * The body is also sanitized when the downstream handlers throw after having set it, as the error
 * middleware keeps an existing body. If the sanitizer itself fails the body is withheld, on any path.
 * It never throws.
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
