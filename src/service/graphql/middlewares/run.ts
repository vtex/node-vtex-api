import { runHttpQuery } from 'apollo-server-core'

import { LRUCache } from '../../../caches'
import { GraphQLServiceContext } from '../typings'
import { defaultMaxAgeFromCtx } from '../utils/maxAgeEnum'

const ONE_HOUR_MS = 60 * 60 * 1e3

const persistedQueries = {
  cache: new LRUCache<string, string>({
    max: 500,
    maxAge: ONE_HOUR_MS,
  }),
}

const linked = !!process.env.VTEX_APP_LINK

export async function run (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {
    method,
    graphql,
    vtex: {production},
    request,
  } = ctx

  const {
    dataSources,
    formatters,
    query,
    schema,
  } = graphql

  const {
    formatError,
    formatResponse,
  } = formatters!

  // We don't want resolvers to have access to the GraphQL context,
  // so we delete it here and restore it after execution.
  delete ctx.graphql

  try {
    const {graphqlResponse, responseInit} = await runHttpQuery([], {
      method,
      options: {
        cacheControl: {
          calculateHttpHeaders: true,
          defaultMaxAge: defaultMaxAgeFromCtx(ctx),
          stripFormattedExtensions: false,
        },
        context: ctx,
        dataSources,
        debug: linked,
        formatError,
        formatResponse,
        persistedQueries,
        schema,
        tracing: linked,
      } as any,
      query: query!,
      request,
    })

    ctx.graphql = graphql
    ctx.graphql.responseInit = responseInit
    ctx.graphql.graphqlResponse = JSON.parse(graphqlResponse)
  } catch (err) {
    ctx.graphql = graphql
    throw err
  }

  await next()
}
