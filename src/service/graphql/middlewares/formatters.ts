import { formatApolloErrors } from 'apollo-server-errors'
import { omit, pick } from 'ramda'

import { cleanError, SENSITIVE_EXCEPTION_FIELDS } from '../../../utils/error'
import { GraphQLServiceContext } from '../typings'

const ERROR_FIELD_WHITELIST = ['message', 'path', 'stack', 'extensions', 'statusCode', 'name', 'headers', 'originalError', 'code']

// formatError overrides the default option in runHttpQuery, which
// does not keep track of the error stack. All non-enumerable
// properties of Error (including stack) need to be returned
// explicitly, otherwise will not show up after a JSON.stringify call
const createFormatError = (details: any) => (error: any) => {
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
        ...omit(SENSITIVE_EXCEPTION_FIELDS, formattedError.originalError),
        sensitive: pick(SENSITIVE_EXCEPTION_FIELDS, formattedError.originalError),
      }
    } else {
      const mergedExceptions = {
        ...formattedError.originalError,
        ...formattedError.extensions.exception,
      }
      const extendedException = {
        message: formattedError.originalError.message,
        name: formattedError.originalError.name,
        ...omit(SENSITIVE_EXCEPTION_FIELDS, mergedExceptions),
        sensitive: pick(SENSITIVE_EXCEPTION_FIELDS, mergedExceptions),
      }
      formattedError.extensions.exception = cleanError(extendedException)
    }

    // Make originalError not enumerable to prevent duplicated log and response information
    Object.defineProperty(formattedError, 'originalError', {enumerable: false})
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

export async function createFormatters (ctx: GraphQLServiceContext, next: () => Promise<void>) {
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
