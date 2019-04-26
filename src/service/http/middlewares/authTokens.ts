import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

export async function authTokens <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { vtex: { account } } = ctx

  ctx.vtex.adminUserAuthToken = ctx.cookies.get('VtexIdclientAutCookie')
  ctx.vtex.storeUserAuthToken = ctx.cookies.get(`VtexIdclientAutCookie_${account}`)

  await next()
}
