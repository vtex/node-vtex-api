import {
  CACHE_CONTROL_HEADER,
  ETAG_HEADER,
  FORWARDED_HOST_HEADER,
  META_HEADER,
  SEGMENT_HEADER,
  SESSION_HEADER,
} from '../../../../../constants'
import { Maybe } from '../../typings'
import { Recorder } from '../../utils/recorder'
import { GraphQLCacheControl, GraphQLServiceContext } from '../typings'
import { cacheControlHTTP } from '../utils/cacheControl'

function setVaryHeaders (ctx: GraphQLServiceContext, cacheControl: GraphQLCacheControl) {
  ctx.vary(FORWARDED_HOST_HEADER)
  if (cacheControl.scope === 'segment') {
    ctx.vary(SEGMENT_HEADER)
  }

  if (cacheControl.scope === 'private' || ctx.query.scope === 'private') {
    ctx.vary(SEGMENT_HEADER)
    ctx.vary(SESSION_HEADER)
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

  ctx.set(CACHE_CONTROL_HEADER, cacheControlHeader)

  if (status === 'error') {
    // Do not generate etag for errors
    ctx.remove(META_HEADER)
    ctx.remove(ETAG_HEADER)
    ctx.vtex.recorder?.clear()
  }

  if (ctx.method.toUpperCase() === 'GET') {
    setVaryHeaders(ctx, cacheControl)
  }

  ctx.body = graphqlResponse
}
