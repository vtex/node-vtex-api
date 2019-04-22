import { IOClients } from '../../../clients/IOClients'
import { LogLevel } from '../../../clients/Logger'
import { cleanError } from '../../../utils/error'
import { ServiceContext } from '../../typings'

const CACHE_CONTROL_HEADER = 'cache-control'
const META_HEADER = 'x-vtex-meta'
const ETAG_HEADER = 'etag'
const TWO_SECONDS_S = 2
const production = process.env.VTEX_PRODUCTION === 'true'

export async function error<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  try {
    await next()
  } catch (e) {
    console.error('[node-vtex-api error]', e)
    const err = cleanError(e)

    // Add response
    ctx.status = e && e.status >= 400 && e.status <= 599
      ? e.status
      : ctx.status >= 500 && ctx.status <= 599
        ? ctx.status
        : 500
    ctx.body = ctx.body || err

    // Do not generate etag for errors
    ctx.remove(META_HEADER)
    ctx.remove(ETAG_HEADER)

    // In production errors, add two second cache
    if (production) {
      ctx.set(CACHE_CONTROL_HEADER, `public, max-age=${TWO_SECONDS_S}`)
    } else {
      ctx.set(CACHE_CONTROL_HEADER, `no-cache, no-store`)
    }

    // Log error
    const {
      method,
      status,
      vtex: {
        operationId,
        requestId,
        route: {
          id,
        },
      },
      headers: {
        'x-forwarded-path': forwardedPath,
        'x-forwarded-host': forwardedHost,
        'x-forwarded-proto': forwardedProto,
        'x-vtex-platform': platform,
      },
    } = ctx

    // Grab level from originalError, default to "error" level.
    let level = err && err.level as LogLevel
    if (!level || !(level === LogLevel.Error || level === LogLevel.Warn)) {
      level = LogLevel.Error
    }

    const log = {
      ...err,
      forwardedHost,
      forwardedPath,
      forwardedProto,
      method,
      operationId,
      platform,
      requestId,
      routeId: id,
      status,
    }

    // Use sendLog directly to avoid cleaning error twice.
    ctx.clients.logger.sendLog('-', log, level).catch((reason) => {
      console.error('Error logging error 🙄 retrying once...', reason ? reason.response : '')
      ctx.clients.logger.sendLog('-', log, level).catch()
    })
  }
}
