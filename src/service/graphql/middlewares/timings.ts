import { GraphQLServiceContext } from '../typings'

export async function graphqlTimings (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const start = process.hrtime()

  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  // Batch success or error metric for entire operation
  metrics.batch(`graphql-operation-${ctx.graphql.status}`, process.hrtime(start))
}
