import { pick } from 'ramda'

import { cleanError } from '../../../utils/error'
import { GraphQLServiceContext } from '../typings'

const ERROR_FIELD_WHITELIST = ['message', 'path', 'stack', 'extensions', 'statusCode', 'name', 'headers', 'originalError', 'code']

const detailsFromCtx = (ctx: GraphQLServiceContext) => {
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
  : ctx.graphql.query && ctx.graphql.query.variables

  const query = {
    ...ctx.graphql.query,
    variables,
  }

  return {
    forwardedHost,
    forwardedProto,
    operationId,
    platform,
    query,
    requestId,
  }
}

const formatError = (error: any, details?: any) => {
  const formattedError = pick(ERROR_FIELD_WHITELIST, error)

  if (!formattedError.extensions) {
    formattedError.extensions = {
      code: 'INTERNAL_SERVER_ERROR',
    }
  }

  if (formattedError.originalError) {
    formattedError.originalError = cleanError(formattedError.originalError)
    if (formattedError.stack === formattedError.originalError.stack) {
      delete formattedError.originalError.stack
    }

    if (!formattedError.extensions.exception) {
      formattedError.extensions.exception = {
        message: formattedError.originalError.message,
        name: formattedError.originalError.name,
        stack: formattedError.originalError.stack,
        ...formattedError.originalError,
      }
    } else {
      const extendedException = {
        message: formattedError.originalError.message,
        name: formattedError.originalError.name,
        stack: formattedError.originalError.stack,
        ...formattedError.originalError,
        ...formattedError.extensions.exception,
      }
      formattedError.extensions.exception = cleanError(extendedException)
    }

    // Make originalError not enumerable to prevent duplicated log and response information
    Object.defineProperty(formattedError, 'originalError', {enumerable: false})
  }

  Object.assign(formattedError, details)

  return formattedError as any
}

//
// TODO: check if the following statement is still valid
//
// formatError overrides the default option in runHttpQuery, which
// does not keep track of the error stack. All non-enumerable
// properties of Error (including stack) need to be returned
// explicitly, otherwise will not show up after a JSON.stringify call
export const createFormatError = (ctx: GraphQLServiceContext) => {
  const details = detailsFromCtx(ctx)
  return (error: any) => formatError(error, details)
}
