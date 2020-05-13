import { isEmpty, pick, reject } from 'ramda'

import { FORWARDED_HOST_HEADER, SEGMENT_HEADER, SESSION_HEADER } from '../../../constants'
import { GraphQLServiceContext } from '../typings'
import { cacheControl } from '../utils/cacheControl'

const DEV_FIELDS = ['data', 'errors', 'extensions']
const PROD_FIELDS = ['data', 'errors']

function setVaryHeaders (ctx: GraphQLServiceContext, scope: string, segment: boolean | null) {
  ctx.vary(FORWARDED_HOST_HEADER)
  if (segment) {
    ctx.vary(SEGMENT_HEADER)
  }

  if (scope === 'private' || ctx.query.scope === 'private') {
    ctx.vary(SESSION_HEADER)
  } else if (ctx.vtex.sessionToken) {
    ctx.vtex.logger.warn({
      message: 'GraphQL resolver receiving session token without private scope',
      userAgent: ctx.headers['user-agent'],
    })
  }
}

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

  if (ctx.method.toUpperCase() === 'GET') {
    setVaryHeaders(ctx, scope, segment)
  }

  const fields = production ? PROD_FIELDS : DEV_FIELDS
  ctx.body = pick(fields, graphqlResponse!)
  await next()
}
