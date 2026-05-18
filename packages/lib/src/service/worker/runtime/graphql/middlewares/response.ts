import {
  HeaderKeys,
} from '../../../../../constants'
import { Maybe } from '../../typings'
import { Recorder } from '../../utils/recorder'
import { GraphQLCacheControl, GraphQLServiceContext } from '../typings'
import { cacheControlHTTP } from '../utils/cacheControl'

function setVaryHeaders (ctx: GraphQLServiceContext, cacheControl: GraphQLCacheControl) {
  ctx.vary(HeaderKeys.FORWARDED_HOST)
  if (cacheControl.scope === 'segment') {
    ctx.vary(HeaderKeys.SEGMENT)
  }
  if (cacheControl.scope === 'private' || ctx.query.scope === 'private') {
    ctx.vary(HeaderKeys.SEGMENT)
    ctx.vary(HeaderKeys.SESSION)
  } else if (ctx.vtex.sessionToken) {
    ctx.vtex.logger.warn({
      message: 'GraphQL resolver receiving session token without private scope',
      userAgent: ctx.get('user-agent'),
    })
  }
}

export async function response (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  await next()
  const {
    cacheControl,
    status,
    graphqlResponse,
  } = ctx.graphql

  const cacheControlHeader = cacheControlHTTP(ctx)
  ctx.set(HeaderKeys.CACHE_CONTROL, cacheControlHeader)

  if (status === 'error') {
    // Do not generate etag for errors
    ctx.remove(HeaderKeys.META)
    ctx.remove(HeaderKeys.ETAG)
    ctx.vtex.recorder?.clear()
  }

  if (ctx.method.toUpperCase() === 'GET') {
    setVaryHeaders(ctx, cacheControl)
  }

  ctx.body = graphqlResponse
}
