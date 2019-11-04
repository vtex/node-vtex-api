import { runHttpQuery } from 'apollo-server-core'

import { LRUCache } from '../../../caches'
import { GraphQLServiceContext } from '../typings'
import { defaultMaxAgeFromCtx } from '../utils/maxAgeEnum'

export const graphqlRuntimeCacheStorage = new LRUCache<string, string>({
  max: 100,
})

const persistedQueries = {
  cache: graphqlRuntimeCacheStorage,
}

const linked = !!process.env.VTEX_APP_LINK

export async function run (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {
    method,
    graphql,
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
        documentStore: graphqlRuntimeCacheStorage,
        formatError,
        formatResponse,
        parseOptions: {
          noLocation: !linked,
        },
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
