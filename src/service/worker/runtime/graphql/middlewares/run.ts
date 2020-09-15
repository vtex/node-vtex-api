import { execute } from 'graphql'

import { GraphQLServiceContext, ExecutableSchema } from '../typings'

export const run = (executableSchema: ExecutableSchema) =>
  async function runHttpQuery(ctx: GraphQLServiceContext, next: () => Promise<void>) {
    const {
      graphql: { query },
    } = ctx

    const { document, operationName, variables: variableValues } = query!
    const schema = executableSchema.schema
    const response = await execute({
      contextValue: ctx,
      document,
      fieldResolver: (root, _, __, info) => root[info.fieldName],
      operationName,
      rootValue: null,
      schema,
      variableValues,
    })
    ctx.graphql.graphqlResponse = response

    await next()
  }
