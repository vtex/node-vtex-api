import { execute } from 'graphql'

import { ExecutableSchema, GraphQLServiceContext } from '../typings'
import { coerceVariableValuesLenient } from '../utils/coerceVariablesLenient'

export const run = (executableSchema: ExecutableSchema) =>
  async function runHttpQuery(ctx: GraphQLServiceContext, next: () => Promise<void>) {
    const {
      graphql: { query },
    } = ctx

    const { document, operationName, variables: variableValues } = query!
    const schema = executableSchema.schema
    const coercedVariables = coerceVariableValuesLenient(schema, document, variableValues, operationName)
    const response = await execute({
      contextValue: ctx,
      document,
      fieldResolver: (root, _, __, info) => root[info.fieldName],
      operationName,
      rootValue: null,
      schema,
      variableValues: coercedVariables,
    })
    ctx.graphql.graphqlResponse = response

    await next()
  }
