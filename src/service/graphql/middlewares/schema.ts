import { makeSchema } from '../schema'
import { GraphQLServiceContext } from '../typings'

export const injectSchema = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
  ctx.graphql.schema = makeSchema(ctx)

  await next()
}
