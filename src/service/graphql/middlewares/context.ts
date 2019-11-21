import { MAX_AGE } from '../../../constants'
import { GraphQLServiceContext } from './../typings'

export async function injectGraphqlContext (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  ctx.graphql = {
    cacheControl: {
      maxAge: MAX_AGE.LONG,
      noCache: false,
      noStore: false,
      scope: 'public',
    },
    status: 'success',
  }

  await next()
}
