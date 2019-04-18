import { any, chain, compose, filter, forEach, has, pluck, prop, uniqBy } from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { toArray } from '../utils/array'
import { generatePathName } from '../utils/pathname'

const CACHE_CONTROL_HEADER = 'cache-control'
const META_HEADER = 'x-vtex-meta'
const ETAG_HEADER = 'etag'
const TWO_SECONDS_S = 2
const sender = process.env.VTEX_APP_ID

const getSplunkQuery = (account: string, workspace: string) =>
  `Try this query at Splunk to retrieve error log: 'index=colossus key=log_error sender="${sender}" account=${account} workspace=${workspace}'`

const parseMessage = pluck('message')

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

const production = process.env.VTEX_PRODUCTION === 'true'

export async function error (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {
    vtex: {
      account,
      workspace,
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
        if (e.originalError && e.originalError.request) {
          return e.originalError.request.path
        }
        return e
      }, graphQLErrors)
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
        // Add pathName to each error
        if (err.path) {
          err.pathName = generatePathName(err.path)
        }

        const log = {
          ...err,
          routeId: id,
        }

        ctx.clients.logger.sendLog('-', log, 'error').catch((reason) => {
          console.error('Error logging error 🙄 retrying once...', reason ? reason.response : '')
          ctx.clients.logger.sendLog('-', log, 'error').catch()
        })
      }, uniqueErrors)

      // Expose graphQLErrors with pathNames to timings middleware
      ctx.graphql.graphQLErrors = uniqueErrors

      // Show message in development environment
      if (!production) {
        console.log(getSplunkQuery(account, workspace))
      }
    } else {
      ctx.graphql.status = 'success'
    }
  }
}
