import { defaultFieldResolver, GraphQLField, print } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { cleanError } from '../../../../../../utils'
import { Logger, LogLevel } from '../../../../../logger/logger'
import { logger as globalLogger } from '../../../../listeners'
import { GraphQLServiceContext } from '../../typings'

export class Telemetry extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, GraphQLServiceContext>) {
    const { resolve = defaultFieldResolver, name } = field

    field.resolve = async (root, args, ctx, info) => {
      let failedToResolve = false
      let result: any = null
      let timeToResolve = 0

      try {
        const start = process.hrtime.bigint()
        result = await resolve(root, args, ctx, info)
        timeToResolve = Number(process.hrtime.bigint() - start) / 1000000 // Milliseconds
      } catch (error) {
        result = error
        failedToResolve = true
      }

      ctx.graphql.status = failedToResolve ? 'error' : 'success'

      this.log(
        failedToResolve ? LogLevel.Error : LogLevel.Info,
        {
          graphql: {
            failedToResolve,
            failureReason: failedToResolve ? cleanError(result) : null,
            name,
            operationName: ctx.graphql.query?.operationName || '',
            query: ctx.graphql.query?.document && print(ctx.graphql.query?.document),
            status: ctx.graphql.status,
            timeToResolve,
            variables: args,
          },
          headers: ctx.request.headers,
          key: 'graphql-telemetry',
        },
        ctx.vtex.logger
      )

      return result
    }
  }

  protected log<T>(level: LogLevel, payload: T, logger: Logger = globalLogger) {
    logger[level](payload)
  }
}

export const telemetryDirectiveTypeDefs = `
directive @telemetry on FIELD_DEFINITION
`
