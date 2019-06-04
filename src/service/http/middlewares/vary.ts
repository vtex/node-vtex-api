import { IOClients } from '../../../clients/IOClients'
import { SEGMENT_HEADER, SESSION_HEADER } from '../../../constants'
import { ServiceContext } from '../../typings'

export async function vary <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { headers, method } = ctx

  // We don't need to vary non GET requests, since they are never cached
  if (method.toUpperCase() !== 'GET') {
    await next()
    return
  }

  if (headers.get(SEGMENT_HEADER)) {
    ctx.vary(SEGMENT_HEADER)
  }
  if (headers.get(SESSION_HEADER)) {
    ctx.vary(SESSION_HEADER)
  }

  await next()
}
