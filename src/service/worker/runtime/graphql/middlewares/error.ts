import { formatApolloErrors } from 'apollo-server-errors'
import { uniqBy } from 'ramda'

import { LINKED } from '../../../../../constants'
import {
  cancelledErrorCode,
  cancelledRequestStatus,
} from '../../../../../errors/RequestCancelledError'
import { redactKnownSecrets } from '../../../../../utils/stringRedactor'
import { LogLevel } from '../../../../logger'
import { IOContext } from '../../typings'
import { redactErrorBody } from '../../utils/redactErrorBody'
import { GraphQLServiceContext } from '../typings'
import { createFormatError } from '../utils/error'
import { generatePathName } from '../utils/pathname'

const TWO_SECONDS_S = 2

const GENERIC_ERROR_MESSAGE = 'Internal server error'

const isPathPart = (part: unknown) => typeof part === 'string' || typeof part === 'number'

// What is sent when the errors could not be redacted: for each error only its message, path and
// code, with the tokens of the request replaced in each, so clients still see what failed.
const withheldErrors = (errors: any[], vtex: IOContext) => {
  const tokens = [vtex.authToken, vtex.adminUserAuthToken, vtex.storeUserAuthToken]
  const redact = (text: string) => redactKnownSecrets(text, tokens).value
  const pathPart = (part: unknown) => typeof part === 'string' ? redact(part) : part
  try {
    return errors.map(err => ({
      extensions: typeof err?.extensions?.code === 'string' ? { code: redact(err.extensions.code) } : undefined,
      message: typeof err?.message === 'string' ? redact(err.message) : GENERIC_ERROR_MESSAGE,
      path: Array.isArray(err?.path) ? err.path.filter(isPathPart).map(pathPart) : undefined,
    }))
  } catch {
    return [{ message: GENERIC_ERROR_MESSAGE }]
  }
}

// The errors sent back, with the tokens of the request and known credential headers replaced. It
// never throws: a failure here would turn the whole GraphQL response into a 500.
const safeGraphQLErrors = (errors: any[], vtex: IOContext) => {
  try {
    return redactErrorBody(errors, vtex)
  } catch (redactError) {
    console.error('[node-vtex-api error] the GraphQL errors could not be sanitized', (redactError as Error)?.name)
    return withheldErrors(errors, vtex)
  }
}

const uniqErrorsByPath = (errors: any[]) => uniqBy(
  e => e.extensions && e.extensions.exception && e.extensions.exception.request
    ? e.extensions.exception.request.path
    : e,
  errors
)

const createLogErrorToSplunk = (vtex: IOContext) => (err: any) => {
  const {
    route: { id },
    logger,
  } = vtex

  try {
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
  } finally {
    if (!LINKED) {
      // Already logged above. The response must not carry them.
      if (err?.extensions?.exception?.sensitive) {
        delete err.extensions.exception.sensitive
      }
      if (err) {
        delete err.stack
      }
    }
  }
}

export async function graphqlError (ctx: GraphQLServiceContext, next: () => Promise<void>) {
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
  }
  catch (e: any) {
    if (e.code === cancelledErrorCode) {
      ctx.status = cancelledRequestStatus
      return
    }

    const formatError = createFormatError(ctx)
    graphQLErrors = Array.isArray(e)
      ? e.map(formatError)
      : [formatError(e)]

    // Add response
    ctx.status = e.statusCode || 500
    if (e.headers) {
      ctx.set(e.headers)
    }
  }
  finally {
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

      // The tokens of the request are replaced wherever they appear in the errors sent back, such
      // as a resolver message that embeds a serialized upstream error. So is the value of a known
      // credential header inside a `headers` object. `data` is not touched.
      const safeErrors = safeGraphQLErrors(uniqueErrors, ctx.vtex)

      ctx.graphql.graphqlResponse = {
        ...ctx.graphql.graphqlResponse,
        errors: safeErrors,
      }

    }
  }
}
