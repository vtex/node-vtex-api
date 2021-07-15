import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { APP } from '../../../../../..'
import { GraphQLServiceContext } from '../../typings'

interface Args {
  name?: string
}

export class Metric extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, GraphQLServiceContext>) {
    const { resolve = defaultFieldResolver, name: fieldName } = field
    const { name = `${APP.NAME}-${fieldName}` } = this.args as Args

    field.resolve = async (root, args, ctx, info) => {
      let failedToResolve = false
      let result: any = null
      let ellapsed: [number, number] = [0, 0]

      try {
        const start = process.hrtime()
        result = await resolve(root, args, ctx, info)
        ellapsed = process.hrtime(start)
      } catch (error) {
        result = error
        failedToResolve = true
      }

      ctx.graphql.status = failedToResolve ? 'error' : 'success'

      const payload = {
        [ctx.graphql.status]: 1,
      }

      metrics.batch(`graphql-metric-${name}`, failedToResolve ? undefined : ellapsed, payload)

      if (failedToResolve) {
        throw result
      }

      return result
    }
  }
}

export const metricDirectiveTypeDefs = `
directive @metric (
  name: String
) on FIELD_DEFINITION
`
