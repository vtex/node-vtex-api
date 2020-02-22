import { formatApolloErrors } from 'apollo-server-errors'
import { uniqBy } from 'ramda'

import { cancelledErrorCode, cancelledRequestStatus } from '../../../../../errors/RequestCancelledError'
import { LogLevel } from '../../../../logger'
import { IOContext } from '../../typings'
import { GraphQLServiceContext } from '../typings'
import { createFormatError } from '../utils/error'
import { generatePathName } from '../utils/pathname'

const TWO_SECONDS_S = 2

const uniqErrorsByPath = (errors: any[]) =>
  uniqBy(
    e =>
      e.extensions && e.extensions.exception && e.extensions.exception.request
        ? e.extensions.exception.request.path
        : e,
    errors
  )

const createLogErrorToSplunk = (vtex: IOContext) => (err: any) => {
  const {
    route: { id },
    logger,
  } = vtex

  // Prevent logging cancellation error (it's not an error)
  if (err?.extensions?.exception?.code === cancelledErrorCode) {
    return
  }

  // Add pathName to each error
  if (err.path) {
    err.pathName = generatePathName(err.path)
  }

  const log = {
    ...err,
    routeId: id,
  }

  // Grab level from originalError, default to "error" level.
  let level = err?.extensions?.exception?.level as LogLevel
  if (!level || !(level === LogLevel.Error || level === LogLevel.Warn)) {
    level = LogLevel.Error
  }
  logger.log(log, level)
}

export async function graphqlError(ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {
    vtex: { production },
  } = ctx

  let graphQLErrors: any = null

  try {
    await next()

    const response = ctx.graphql.graphqlResponse

    if (response && Array.isArray(response.errors)) {
      const formatter = createFormatError(ctx)
      graphQLErrors = formatApolloErrors(response.errors, { formatter })
    }
  } catch (e) {
    if (e.code === cancelledErrorCode) {
      ctx.status = cancelledRequestStatus
      return
    }

    const formatError = createFormatError(ctx)
    graphQLErrors = Array.isArray(e) ? e.map(formatError) : [formatError(e)]

    // Add response
    ctx.status = e.statusCode || 500
    if (e.headers) {
      ctx.set(e.headers)
    }
  } finally {
    if (graphQLErrors) {
      ctx.graphql.status = 'error'

      // Filter errors from the same path in the query. This should
      // avoid logging multiple errors from an array for example
      const uniqueErrors = uniqErrorsByPath(graphQLErrors)

      // Log each error to splunk individually
      const logToSplunk = createLogErrorToSplunk(ctx.vtex)
      uniqueErrors.forEach(logToSplunk)

      // In production errors, add two second cache
      if (production) {
        ctx.graphql.cacheControl.maxAge = TWO_SECONDS_S
      } else {
        ctx.graphql.cacheControl.noCache = true
        ctx.graphql.cacheControl.noStore = true
      }

      ctx.graphql.graphqlResponse = {
        ...ctx.graphql.graphqlResponse,
        errors: uniqueErrors,
      }
    }
  }
}
