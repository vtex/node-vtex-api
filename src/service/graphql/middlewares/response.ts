import { isEmpty, pick, reject } from 'ramda'

import { SEGMENT_HEADER } from '../../../constants'
import { GraphQLServiceContext } from '../typings'
import { cacheControl } from '../utils/cacheControl'

export async function response (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {responseInit, graphqlResponse} = ctx.graphql
  const {production} = ctx.vtex

  const {
    maxAge = '',
    scope = '',
    segment = null,
  } = graphqlResponse ? cacheControl(graphqlResponse, ctx) : {}
  const cacheControlHeader = reject(isEmpty, [maxAge, scope]).join(',')

  ctx.set({
    ...responseInit && responseInit.headers,
    'Cache-Control': cacheControlHeader,
  })

  if (segment) {
    ctx.vary(SEGMENT_HEADER)
  }

  const fields = production
    ? ['data', 'errors']
    : ['data', 'errors', 'extensions']

  ctx.body = pick(fields, graphqlResponse!)
  await next()
}
