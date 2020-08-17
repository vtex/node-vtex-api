import { omit, pick } from 'ramda'

import { cleanError } from '../../../../../utils/error'
import { GraphQLServiceContext } from '../typings'

const ERROR_FIELD_WHITELIST = ['message', 'path', 'stack', 'extensions', 'statusCode', 'name', 'headers', 'originalError', 'code']
const QUERY_FIELDS = ['query', 'operationName', 'variables']
const SENSITIVE_EXCEPTION_DATA = ['config', 'request', 'response', 'stack']

const trimVariables = (variables: object) => {
  if (variables) {
    const stringifiedVariables = JSON.stringify(variables)
    return stringifiedVariables.length <= 1024
      ? stringifiedVariables
      : `${stringifiedVariables.slice(0, 992)} [Truncated: variables too long]`
  }
  return ''
}

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

  const queryRest = pick<any>(QUERY_FIELDS, ctx.graphql.query || {})
  const variables = ctx.request.is('multipart/form-data')
    ? '[GraphQL Upload]'
    : trimVariables(queryRest.variables)
  const query = {
    ...queryRest,
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
        ...omit(SENSITIVE_EXCEPTION_DATA, formattedError.originalError),
        sensitive: pick(SENSITIVE_EXCEPTION_DATA, formattedError.originalError),
      }
    } else {
      const mergedException = {...formattedError.originalError,
        ...formattedError.extensions.exception,
      }
      const extendedException = {
        message: formattedError.originalError.message,
        name: formattedError.originalError.name,
        ...omit(SENSITIVE_EXCEPTION_DATA, mergedException),
        sensitive: pick(SENSITIVE_EXCEPTION_DATA, mergedException),
      }
      formattedError.extensions.exception = cleanError(extendedException)
    }

    // Make originalError not enumerable to prevent duplicated log and response information
    Object.defineProperty(formattedError, 'originalError', {enumerable: false})
  }

  Object.assign(formattedError, details)

  return formattedError as any
}

export const createFormatError = (ctx: GraphQLServiceContext) => {
  const details = detailsFromCtx(ctx)
  return (error: any) => formatError(error, details)
}
