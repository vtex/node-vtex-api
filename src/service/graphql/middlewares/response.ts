import { pick } from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { cacheControl } from '../utils/cacheControl'

const SEGMENT_HEADER = 'x-vtex-segment'

export const response = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
  const {responseInit, graphqlResponse} = ctx.graphql

  const {
    maxAge = '',
    scope = '',
    segment = null,
  } = graphqlResponse ? cacheControl(graphqlResponse, ctx) : {}

  ctx.set({
    ...responseInit && responseInit.headers,
    'Cache-Control': `${maxAge}, ${scope}`,
  })

  if (segment) {
    ctx.vary(SEGMENT_HEADER)
  }

  ctx.body = pick(['data', 'errors'], graphqlResponse!)

  await next()
}
