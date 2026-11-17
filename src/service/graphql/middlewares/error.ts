import { any, chain, compose, filter, forEach, has, map, prop, uniqBy } from 'ramda'

import { LogLevel } from '../../../clients/Logger'
import { LINKED } from '../../../constants'
import { cancelledErrorCode, cancelledRequestStatus } from '../../../errors/RequestCancelledError'
import { redactKnownSecrets } from '../../../utils/stringRedactor'
import { IOContext } from '../../typings'
import { redactErrorBody } from '../../utils/redactErrorBody'
import { GraphQLServiceContext } from '../typings'
import { toArray } from '../utils/array'
import { generatePathName } from '../utils/pathname'

const CACHE_CONTROL_HEADER = 'cache-control'
const META_HEADER = 'x-vtex-meta'
const ETAG_HEADER = 'etag'
const TWO_SECONDS_S = 2

const GENERIC_ERROR_MESSAGE = 'Internal server error'

const arrayHasError = any(has('errors'))

const filterErrors = filter(has('errors')) as (x: ReadonlyArray<{}>) => ReadonlyArray<{}>

const chainErrors = chain(prop<any, any>('errors'))

const hasError = compose(arrayHasError, toArray)

const parseError = compose(chainErrors, filterErrors, toArray)

const parseErrorResponse = (response: any) => {
  if (hasError(response)) {
    return parseError(response)
  }
  return null
}

const isPathPart = (part: unknown) => typeof part === 'string' || typeof part === 'number'

// What is sent when the errors could not be redacted: for each error only its message, path and
// code, with the tokens of the request replaced in each, so clients still see what failed.
const withheldErrors = (errors: any[], vtex: IOContext) => {
  const tokens = [vtex.authToken, vtex.adminUserAuthToken, vtex.storeUserAuthToken]
  const redact = (text: string) => redactKnownSecrets(text, tokens).value
  const pathPart = (part: unknown) => typeof part === 'string' ? redact(part) : part
  try {
    return errors.map(err => ({
      extensions: err && err.extensions && typeof err.extensions.code === 'string' ? { code: redact(err.extensions.code) } : undefined,
      message: err && typeof err.message === 'string' ? redact(err.message) : GENERIC_ERROR_MESSAGE,
      path: err && Array.isArray(err.path) ? err.path.filter(isPathPart).map(pathPart) : undefined,
    }))
  } catch {
    return [{ message: GENERIC_ERROR_MESSAGE }]
  }
}

const isMap = (value: unknown) => value !== null && typeof value === 'object' && !Array.isArray(value)

// A value that fails to serialize during the redaction becomes `[Unserializable]` instead of
// throwing, so a field GraphQL requires to be a map or a list may come back as a string.
const isGraphQLError = (err: unknown) => {
  if (!isMap(err)) {
    return false
  }
  const { extensions, locations, message, path } = err as Record<string, unknown>
  return typeof message === 'string' &&
    (extensions == null || isMap(extensions)) &&
    (locations == null || Array.isArray(locations)) &&
    (path == null || Array.isArray(path))
}

// The errors sent back, with the tokens of the request and known credential headers replaced. It
// never throws: a failure here would turn the whole GraphQL response into a 500.
const safeGraphQLErrors = (errors: any[], vtex: IOContext) => {
  try {
    const redacted = redactErrorBody(errors, vtex)
    if (Array.isArray(redacted) && redacted.every(isGraphQLError)) {
      return redacted
    }
    console.error('[node-vtex-api error] the sanitized GraphQL errors are not valid GraphQL errors')
  } catch (redactError) {
    const failure = redactError as Error
    console.error('[node-vtex-api error] the GraphQL errors could not be sanitized', failure && failure.name)
  }
  return withheldErrors(errors, vtex)
}

const createLogErrorToSplunk = (vtex: IOContext) => (err: any) => {
  const {
    route: { id },
    logger,
  } = vtex

  try {
    // Prevent logging cancellation error (it's not an error)
    if (err && err.extensions && err.extensions.exception && err.extensions.exception.code === cancelledErrorCode) {
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
    let level = err.extensions && err.extensions.exception && err.extensions.exception.level as LogLevel
    if (!level || !(level === LogLevel.Error || level === LogLevel.Warn)) {
      level = LogLevel.Error
    }
    logger.log(log, level)
  } finally {
    if (!LINKED) {
      // Already logged above. The response must not carry them.
      if (err && err.extensions && err.extensions.exception && err.extensions.exception.sensitive) {
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
    vtex: {
      production,
    },
  } = ctx

  let graphQLErrors: any[] | null = null

  try {
    await next()

    graphQLErrors = parseErrorResponse(ctx.graphql.graphqlResponse || {})
  }
  catch (e) {
    if (e.code === cancelledErrorCode) {
      ctx.status = cancelledRequestStatus
      return
    }
    const formatError = ctx.graphql.formatters!.formatError

    if (e.isGraphQLError) {
      const response = JSON.parse(e.message)
      graphQLErrors = parseError(response)
      ctx.body = response
    } else {
      graphQLErrors = [formatError(e)]
      ctx.body = {errors: graphQLErrors}
    }

    // Add response
    ctx.status = e.statusCode || 500
    if (e.headers) {
      ctx.set(e.headers)
    }
  }
  finally {
    if (graphQLErrors) {
      const uniqueErrors = uniqBy((e) => {
        if (e.extensions.exception && e.extensions.exception.request) {
          return e.extensions.exception.request.path
        }
        return e
      }, graphQLErrors)

      // Reduce size of `variables` prop in the errors.
      map((e) => {
        if (e.query && e.query.variables) {
          const stringifiedVariables = JSON.stringify(e.query.variables)
          e.query.variables = stringifiedVariables.length <= 1024 ? stringifiedVariables : '[variables too long]'
        }
      }, uniqueErrors)
      let printable: unknown
      try {
        printable = redactErrorBody(uniqueErrors, ctx.vtex)
      } catch {
        printable = withheldErrors(uniqueErrors, ctx.vtex)
      }
      console.error(`[node-vtex-api graphql errors] total=${graphQLErrors.length} unique=${uniqueErrors.length}`, printable)
      ctx.graphql.status = 'error'

      // Do not generate etag for errors
      ctx.remove(META_HEADER)
      ctx.remove(ETAG_HEADER)

      // In production errors, add two second cache
      if (production) {
        ctx.set(CACHE_CONTROL_HEADER, `public, max-age=${TWO_SECONDS_S}`)
      } else {
        ctx.set(CACHE_CONTROL_HEADER, `no-cache, no-store`)
      }

      // Log each error to splunk individually
      forEach(createLogErrorToSplunk(ctx.vtex), uniqueErrors)

      // The tokens of the request are replaced wherever they appear in the errors sent back, such
      // as a resolver message that embeds a serialized upstream error. So is the value of a known
      // credential header inside a `headers` object. `data` is not touched.
      const safeErrors = safeGraphQLErrors(uniqueErrors, ctx.vtex)

      if (ctx.body && (ctx.body as any).errors) {
        const body = ctx.body as any
        body.errors = safeErrors
      }

      // Expose graphQLErrors with pathNames to timings middleware
      ctx.graphql.graphQLErrors = safeErrors
    } else {
      ctx.graphql.status = 'success'
    }
  }
}
