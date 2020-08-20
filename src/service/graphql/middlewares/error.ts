import { any, chain, compose, filter, forEach, has, map, prop, uniqBy } from 'ramda'

import { LogLevel } from '../../../clients/Logger'
import { LINKED } from '../../../constants'
import { cancelledErrorCode, cancelledRequestStatus } from '../../../errors/RequestCancelledError'
import { GraphQLServiceContext } from '../typings'
import { toArray } from '../utils/array'
import { generatePathName } from '../utils/pathname'

const CACHE_CONTROL_HEADER = 'cache-control'
const META_HEADER = 'x-vtex-meta'
const ETAG_HEADER = 'etag'
const TWO_SECONDS_S = 2

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

export async function graphqlError (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {
    vtex: {
      production,
      route: {
        id,
      },
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
      console.error(`[node-vtex-api graphql errors] total=${graphQLErrors.length} unique=${uniqueErrors.length}`, uniqueErrors)
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
      forEach((err: any) => {
        // Prevent logging cancellation error (it's not an error)
        if (!err.extensions.exception || err.extensions.exception.code !== cancelledErrorCode) {
          // Add pathName to each error
          if (err.path) {
            err.pathName = generatePathName(err.path)
          }

          const log = {
            ...err,
            routeId: id,
          }

          // Grab level from originalError, default to "error" level.
          let level = err.extensions.exception && err.extensions.exception.level as LogLevel
          if (!level || !(level === LogLevel.Error || level === LogLevel.Warn)) {
            level = LogLevel.Error
          }
          ctx.vtex.logger.log(log, level)
        }

        if (!LINKED && err.extensions.exception && err.extensions.exception.sensitive) {
          delete err.extensions.exception.sensitive
        }
      }, uniqueErrors)

      // Expose graphQLErrors with pathNames to timings middleware
      ctx.graphql.graphQLErrors = uniqueErrors
    } else {
      ctx.graphql.status = 'success'
    }
  }
}
