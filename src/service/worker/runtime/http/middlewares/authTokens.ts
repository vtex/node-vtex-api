import { IOClients } from '../../../../../clients/IOClients'
import { ServiceContext } from '../../typings'

const JANUS_ENV_COOKIE_KEY = 'vtex-commerce-env'
const VTEX_ID_COOKIE_KEY = 'VtexIdclientAutCookie'

export async function authTokens <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { vtex: { account } } = ctx

  ctx.vtex.adminUserAuthToken = ctx.cookies.get(VTEX_ID_COOKIE_KEY)
  ctx.vtex.storeUserAuthToken = ctx.cookies.get(`${VTEX_ID_COOKIE_KEY}_${account}`)
  ctx.vtex.janusEnv = ctx.cookies.get(JANUS_ENV_COOKIE_KEY)

  await next()
}
