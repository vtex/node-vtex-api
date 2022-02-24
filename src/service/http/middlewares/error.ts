import { IOClients } from '../../../clients/IOClients'
import { LogLevel } from '../../../clients/Logger'
import { LINKED } from '../../../constants'
import { cancelledRequestStatus, RequestCancelledError } from '../../../errors/RequestCancelledError'
import { TooManyRequestsError, tooManyRequestsStatus } from '../../../errors/TooManyRequestsError'
import { cleanError } from '../../../utils/error'
import { FIRST_LEVEL_SENSITIVE_FIELDS as SENSITIVE_EXCEPTION_FIELDS } from '../../../utils/log'
import { ServiceContext } from '../../typings'

const CACHE_CONTROL_HEADER = 'cache-control'
const META_HEADER = 'x-vtex-meta'
const ETAG_HEADER = 'etag'
const TWO_SECONDS_S = 2
const production = process.env.VTEX_PRODUCTION === 'true'

const logAndRemoveSensitiveData = <T extends IOClients, U, V> (
  ctx: ServiceContext<T, U, V>,
  err: any
) => {
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

export async function error<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  try {
    await next()
  } catch (e) {
    if (e instanceof RequestCancelledError) {
      ctx.status = cancelledRequestStatus
      return
    }
    if (e instanceof TooManyRequestsError) {
      ctx.status = tooManyRequestsStatus
      return
    }
    console.error('[node-vtex-api error]', e)
    const err = cleanError(e)

    // Add response
    ctx.status = e && e.status >= 400 && e.status <= 599
      ? e.status
      : ctx.status >= 500 && ctx.status <= 599
        ? ctx.status
        : 500

    // Do not generate etag for errors
    ctx.remove(META_HEADER)
    ctx.remove(ETAG_HEADER)

    // In production errors, add two second cache
    if (production) {
      ctx.set(CACHE_CONTROL_HEADER, `public, max-age=${TWO_SECONDS_S}`)
    } else {
      ctx.set(CACHE_CONTROL_HEADER, `no-cache, no-store`)
    }

    logAndRemoveSensitiveData(ctx, err)
    ctx.body = ctx.body || err
  }
}
