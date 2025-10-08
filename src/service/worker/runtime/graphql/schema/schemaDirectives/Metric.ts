import { defaultFieldResolver, GraphQLField } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { Attributes } from '@opentelemetry/api'
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

      const status = failedToResolve ? 'error' : 'success'
      ctx.graphql.status = status

      const payload = {
        [status]: 1,
      }

      // Legacy metrics (backward compatibility)
      metrics.batch(`graphql-metric-${name}`, failedToResolve ? undefined : ellapsed, payload)

      // New diagnostics metrics with stable names and attributes
      if (global.diagnosticsMetrics) {
        const attributes: Attributes = {
          component: 'graphql',
          field_name: name,
          status,
        }

        // Record latency histogram (record all requests, not just successful ones)
        global.diagnosticsMetrics.recordLatency(ellapsed, attributes)

        // Increment counter (status is an attribute, not in metric name)
        global.diagnosticsMetrics.incrementCounter('graphql_field_requests_total', 1, attributes)
      } else {
        console.warn('DiagnosticsMetrics not available. GraphQL field metrics not reported.')
      }

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
