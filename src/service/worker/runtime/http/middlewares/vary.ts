import { IOClients } from '../../../../../clients/IOClients'
import {
  LOCALE_HEADER,
  SEGMENT_HEADER,
  SESSION_HEADER,
} from '../../../../../constants'
import { ServiceContext } from '../../typings'

export async function vary <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const { method } = ctx

  // We don't need to vary non GET requests, since they are never cached
  if (method.toUpperCase() !== 'GET') {
    await next()
    return
  }

  ctx.vary(LOCALE_HEADER)
  if (ctx.get(SEGMENT_HEADER)) {
    ctx.vary(SEGMENT_HEADER)
  }
  if (ctx.get(SESSION_HEADER)) {
    ctx.vary(SESSION_HEADER)
  }

  await next()
}
