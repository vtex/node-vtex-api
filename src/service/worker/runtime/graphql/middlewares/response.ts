import {
  CACHE_CONTROL_HEADER,
  ETAG_HEADER,
  FORWARDED_HOST_HEADER,
  META_HEADER,
  SEGMENT_HEADER,
  USE_FAST_RECORDER,
} from '../../../../../constants'
import { Maybe } from '../../typings'
import { Recorder } from '../../utils/recorder'
import { GraphQLServiceContext } from '../typings'
import { cacheControlHTTP } from '../utils/cacheControl'

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
    if (USE_FAST_RECORDER) {
      (ctx.vtex.recorder as Maybe<Recorder>)?.clear()
    } else {
      delete ctx.vtex.recorder
    }
  }

  ctx.vary(FORWARDED_HOST_HEADER)
  if (cacheControl.scope === 'segment') {
    ctx.vary(SEGMENT_HEADER)
  }

  ctx.body = graphqlResponse
}
