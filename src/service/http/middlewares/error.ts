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
    ctx.status = e && e.status >= 400 && e.status <= 599
      ? e.status
      : ctx.status >= 500 && ctx.status <= 599
        ? ctx.status
        : 500
    ctx.body = ctx.body || err
    ctx.set(CACHE_CONTROL_HEADER, production ? `public, max-age=${TWO_SECONDS_S}` : `no-cache, no-store`)

    // Rethrows to be caught by logger middleware
    throw err
  }
}
