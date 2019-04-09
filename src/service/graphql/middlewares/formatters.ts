import { formatApolloErrors } from 'apollo-server-errors'
import { pick } from 'ramda'

import { cleanError } from '../../../utils/error'
import { GraphQLServiceContext } from '../typings'

const ERROR_FIELD_WHITELIST = ['message', 'path', 'stack', 'extensions', 'statusCode', 'name', 'headers', 'originalError', 'code']

// formatError overrides the default option in runHttpQuery, which
// does not keep track of the error stack. All non-enumerable
// properties of Error (including stack) need to be returned
// explicitly, otherwise will not show up after a JSON.stringify call
const createFormatError = (details: any) => (error: any) => {
  const formattedError = pick(ERROR_FIELD_WHITELIST, error)

  if (formattedError.extensions && formattedError.extensions.exception) {
    formattedError.extensions.exception = cleanError(formattedError.extensions.exception)
    if (formattedError.stack === formattedError.extensions.exception.stack) {
      delete formattedError.extensions.exception.stack
    }
  }

  if (formattedError.originalError) {
    formattedError.originalError = cleanError(formattedError.originalError)
    if (formattedError.stack === formattedError.originalError.stack) {
      delete formattedError.originalError.stack
    }
  }

  Object.assign(formattedError, details)

  return formattedError as any
}

const createFormatResponse = (formatter: (e: any) => any) => (response: any) => {
  const {errors = null} = response || {}

  return {
    ...response,
    errors: Array.isArray(errors) ? formatApolloErrors(errors, {formatter}) : undefined,
  }
}

export const createFormatters = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
  const {
    headers: {
      'x-forwarded-host': forwardedHost,
      'x-forwarded-proto': forwardedProto,
      'x-vtex-platform': platform,
    },
    vtex: {
      operationId,
      requestId,
    },
  } = ctx

  // Do not log variables for file uploads
  const variables = ctx.request.is('multipart/form-data')
  ? '[GraphQL Upload]'
  : ctx.graphql.query && (ctx.graphql.query as any).variables

  const query = {
    ...ctx.graphql.query,
    variables,
  }

  const details = {
    forwardedHost,
    forwardedProto,
    operationId,
    platform,
    query,
    requestId,
  }

  const formatError = createFormatError(details)
  const formatResponse = createFormatResponse(formatError)

  ctx.graphql.formatters = {
    formatError,
    formatResponse,
  }

  await next()
}
