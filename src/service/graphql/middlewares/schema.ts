import { makeSchema } from '../schema'
import { GraphQLServiceContext } from '../typings'

export async function injectSchema (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  ctx.graphql.schema = makeSchema(ctx)

  await next()
}
