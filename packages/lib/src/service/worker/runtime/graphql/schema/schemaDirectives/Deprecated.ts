import {
  defaultFieldResolver,
  GraphQLArgument,
  GraphQLField,
  GraphQLInputField,
  print,
} from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { Logger } from '../../../../../logger/logger'
import { logger as globalLogger } from '../../../../listeners'
import { GraphQLServiceContext } from '../../typings'

let lastLog = process.hrtime()

const LOG_PERIOD_S = 60

interface DeprecatedOptions {
  reason?: string
}

const hrtimeToS = (time: [number, number]) => time[0] + (time[1] / 1e9)

export class Deprecated extends SchemaDirectiveVisitor {
  public visitArgumentDefinition (argument: GraphQLArgument) {
    this.maybeLogToSplunk({
      description: argument.description,
      name: argument.name,
    })
  }

  public visitInputFieldDefinition (field: GraphQLInputField) {
    this.maybeLogToSplunk({
      description: field.description,
      name: field.name,
    })
  }

  public visitFieldDefinition (field: GraphQLField<any, GraphQLServiceContext>) {
    const { resolve = defaultFieldResolver, name, type } = field
    const { reason }: DeprecatedOptions = this.args

    field.resolve = (root, args, ctx, info) => {
      this.maybeLogToSplunk({
        headers: ctx.request.headers,
        name,
        query: ctx.graphql.query?.document && print(ctx.graphql.query?.document),
        reason,
        variables: ctx.graphql.query?.variables,
      }, ctx.vtex.logger)
      return resolve(root, args, ctx, info)
    }
  }

  protected maybeLogToSplunk <T>(payload: T, logger: Logger = globalLogger) {
    const now = process.hrtime()
    const timeSinceLastLog = hrtimeToS([
      now[0] - lastLog[0],
      now[1] - lastLog[1],
    ])
    if (timeSinceLastLog > LOG_PERIOD_S) {
      lastLog = now
      logger.warn({
        message: 'Deprecated field in use',
        ...payload,
      })
    }
  }
}

export const deprecatedDirectiveTypeDefs = `
directive @deprecated(
  reason: String = "No longer supported"
) on
    FIELD_DEFINITION
  | INPUT_FIELD_DEFINITION
  | ARGUMENT_DEFINITION
  | FRAGMENT_DEFINITION
`
