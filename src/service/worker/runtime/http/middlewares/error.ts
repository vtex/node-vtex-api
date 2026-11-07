import { IOClients } from '../../../../../clients/IOClients'
import { LINKED } from '../../../../../constants'
import {
  cancelledRequestStatus,
  RequestCancelledError,
} from '../../../../../errors/RequestCancelledError'
import {
  TooManyRequestsError,
  tooManyRequestsStatus,
} from '../../../../../errors/TooManyRequestsError'
import { cleanError, SENSITIVE_EXCEPTION_FIELDS } from '../../../../../utils/error'
import { sanitizeErrors, toLoggableError } from '../../../../../utils/responseSanitizer'
import { redactKnownSecretsDeep } from '../../../../../utils/stringRedactor'
import { LogLevel } from '../../../../logger'
import {
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '../../typings'
import { WITHHELD_BODY } from './sanitizeResponse'

const CACHE_CONTROL_HEADER = 'cache-control'
const META_HEADER = 'x-vtex-meta'
const ETAG_HEADER = 'etag'
const TWO_SECONDS_S = 2
const production = process.env.VTEX_PRODUCTION === 'true'

// todo: unify GraphQL and REST exception treatment
const logAndRemoveSensitiveData = <
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
> (ctx: ServiceContext<T, U, V>,err: any) => {
  const {
    method,
    status,
    query,
    vtex: {
      operationId,
      requestId,
      route: {
        id,
        params,
      },
      serverTiming,
    },
    headers: {
      'x-forwarded-path': forwardedPath,
      'x-forwarded-host': forwardedHost,
      'x-forwarded-proto': forwardedProto,
      'x-vtex-caller': caller,
      'x-vtex-platform': platform,
      'x-vtex-product': product,
      'x-vtex-locale': locale,
    },
  } = ctx

  // Grab level from originalError, default to "error" level.
  let level = err && err.level as LogLevel
  if (!level || !(level === LogLevel.Error || level === LogLevel.Warn)) {
    level = LogLevel.Error
  }

  const log = {
    ...err,
    caller,
    forwardedHost,
    forwardedPath,
    forwardedProto,
    locale,
    method,
    operationId,
    params,
    platform,
    product,
    query,
    requestId,
    routeId: id,
    serverTiming,
    status,
  }

  // Use sendLog directly to avoid cleaning error twice.
  ctx.vtex.logger.log(log, level)
  if (!LINKED) {
    SENSITIVE_EXCEPTION_FIELDS.forEach(field => {
      delete err[field]
    })
  }
}

// What is sent to the client for a thrown value. It is built with the sanitizer that covers the
// bodies the app sets, so both paths expose the same: `cleanError` alone removes credentials only
// at the top level, and by a short list of header names, so an error that is a property of the
// thrown value (`originalError`) kept its config, request and stack.
// The tokens of the request are replaced wherever they appear, such as in a message that embeds
// them (`new Error(`failed: ${token}`)`). So is the value of a credential-named field (`apiKey`,
// `authorization`, `cookie`…), even when that value is not one of those tokens. This is an error
// path: successful bodies are not walked for credentials.
const buildResponseBody = (thrown: any, ctx: ServiceContext) => {
  try {
    const body = cleanError(sanitizeErrors(thrown, { linked: LINKED }).value)
    const { authToken, adminUserAuthToken, storeUserAuthToken } = ctx.vtex ?? {}
    return redactKnownSecretsDeep(body, [authToken, adminUserAuthToken, storeUserAuthToken]).value
  } catch (sanitizeError) {
    console.error('[node-vtex-api error] the thrown value could not be sanitized', (sanitizeError as Error)?.name)
    return WITHHELD_BODY
  }
}

export async function error (ctx: ServiceContext, next: () => Promise<void>) {
  try {
    await next()
  } catch (e: any) {
    if (e instanceof RequestCancelledError) {
      ctx.status = cancelledRequestStatus
      return
    }
    if (e instanceof TooManyRequestsError) {
      ctx.status = tooManyRequestsStatus
      return
    }
    // The raw error carries the request config, whose headers include credentials.
    console.error('[node-vtex-api error]', toLoggableError(e))
    const err = cleanError(e)

    // Add response
    ctx.status = e?.status && e.status >= 400 && e.status <= 599
      ? e.status
      : ctx.status >= 500 && ctx.status <= 599
        ? ctx.status
        : 500
    
    // Do not generate etag for errors
    ctx.remove(META_HEADER)
    ctx.remove(ETAG_HEADER)
    ctx.vtex.recorder?.clear()

    // In production errors, add two second cache
    if (production) {
      ctx.set(CACHE_CONTROL_HEADER, `public, max-age=${TWO_SECONDS_S}`)
    } else {
      ctx.set(CACHE_CONTROL_HEADER, `no-cache, no-store`)
    }

    // `err` is what is logged, which keeps the config and the request to debug with. It is not the
    // body: the sanitized value is.
    logAndRemoveSensitiveData(ctx, err)
    ctx.body = ctx.body || buildResponseBody(e, ctx)
  }
}
