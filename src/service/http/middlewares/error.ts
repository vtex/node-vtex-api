import { IOClients } from '../../../clients/IOClients'
import { cleanError } from '../../../utils/error'
import { ServiceContext } from '../../typings'

const CACHE_CONTROL_HEADER = 'cache-control'
const TWO_SECONDS_S = 10
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
    ctx.set(CACHE_CONTROL_HEADER, production ? `public, max-age=${TWO_SECONDS_S}` : `no-cache, no-store`)

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

    // Use sendLog directly to avoid cleaning error twice.
    const log = {
      ...error,
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

    ctx.clients.logger.sendLog('-', log, 'error').catch((reason) => {
      console.error('Error logging error 🙄 retrying once...', reason ? reason.response : '')
      ctx.clients.logger.sendLog('-', log, 'error').catch()
    })
  }
}
