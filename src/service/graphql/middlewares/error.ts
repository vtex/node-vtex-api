import { any, chain, compose, filter, forEach, has, pluck, prop } from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { toArray } from '../utils/array'
import { formatError } from '../utils/formatError'
import { generatePathName } from '../utils/pathname'

const sender = process.env.VTEX_APP_ID

const getSplunkQuery = (account: string, workspace: string) =>
  `Try this query at Splunk to retrieve error log: 'index=colossus key=log_error sender="${sender}" account=${account} workspace=${workspace}`

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

export async function error (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {
    headers: {
      'x-forwarded-host': forwardedHost,
      'x-forwarded-proto': forwardedProto,
      'x-vtex-platform': platform,
    },
    vtex: {
      account,
      workspace,
      production,
      operationId,
      requestId,
      route: {
        id,
      },
    },
  } = ctx

  let graphqlErrors: any[] | null = null

  try {
    await next()

    graphqlErrors = parseErrorResponse(ctx.graphql.graphqlResponse || {})
  }
  catch (e) {
    if (e.isGraphQLError) {
      const response = JSON.parse(e.message)
      graphqlErrors = parseError(response)
      ctx.body = response
    } else {
      graphqlErrors = [formatError(e)]
      ctx.body = {errors: graphqlErrors}
    }

    // Add response
    ctx.status = e.statusCode || 500
    if (e.headers) {
      ctx.set(e.headers)
    }
  }
  finally {
    if (graphqlErrors) {
      ctx.graphql.status = 'error'
      ctx.set('Cache-Control', 'no-cache, no-store')

      // Log each error to splunk individually
      forEach((err: any) => {
        // Add pathName to each error
        if (err.path) {
          err.pathName = generatePathName(err.path)
        }

        const log = {
          ...err,
          forwardedHost,
          forwardedProto,
          operationId,
          platform,
          query: ctx.graphql.query,
          requestId,
          routeId: id,
        }

        ctx.clients.logger.sendLog('-', log, 'error').catch((reason) => {
          console.error('Error logging error 🙄 retrying once...', reason ? reason.response : '')
          ctx.clients.logger.sendLog('-', log, 'error').catch()
        })
      }, graphqlErrors)

      // Expose graphqlErrors with pathNames to timings middleware
      ctx.graphql.graphqlErrors = graphqlErrors

      // Show message in development environment
      if (!production) {
        const message = parseMessage(graphqlErrors)
        console.error(message.join('\n'))
        console.log(getSplunkQuery(account, workspace))
      }
    } else {
      ctx.graphql.status = 'success'
    }
  }
}
