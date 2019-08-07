import { pick } from 'ramda'

export async function contextNormalizer (ctx: any, next: () => Promise<any>) {

  ctx.vtex = pick(['account', 'workspace' , 'authToken' , 'region' , 'production' , 'userAgent' , 'segmentToken' , 'sessionToken' , 'requestId' , 'operationId' , 'product'], ctx)
  ctx.event = pick(['key', 'sender', 'subject'], ctx)

  await next()
}
