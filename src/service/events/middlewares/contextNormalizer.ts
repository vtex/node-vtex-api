import { pick } from 'ramda'

export async function contextNormalizer (ctx: any, next: () => Promise<any>) {

  const vtexProperties = pick(['account', 'authToken', 'region', 'workspace'], ctx)
  const eventProperties = ctx.body

  ctx.vtex = {
    ...ctx.vtex,
    vtexProperties,
  }

  ctx.event = {
    ...ctx.event,
    eventProperties,
  }

  await next()
}
