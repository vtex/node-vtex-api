import { isEmpty, pick, reject } from 'ramda'

import { SEGMENT_HEADER } from '../../../constants'
import { GraphQLServiceContext } from '../typings'
import { cacheControl } from '../utils/cacheControl'

const DEV_FIELDS = ['data', 'errors', 'extensions']
const PROD_FIELDS = ['data', 'errors']

export async function response(
  ctx: GraphQLServiceContext,
  next: () => Promise<void>
) {
  const { responseInit, graphqlResponse } = ctx.graphql
  const { production } = ctx.vtex

  const { maxAge = '', scope = '', segment = null } = graphqlResponse
    ? cacheControl(graphqlResponse, ctx)
    : {}
  const cacheControlHeader = reject(isEmpty, [maxAge, scope]).join(',')

  ctx.set({
    ...(responseInit && responseInit.headers),
    'Cache-Control': cacheControlHeader,
  })

  if (segment) {
    ctx.vary(SEGMENT_HEADER)
  }

  const fields = production ? PROD_FIELDS : DEV_FIELDS
  ctx.body = pick(fields, graphqlResponse!)
  await next()
}
