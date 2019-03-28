import { any, chain, compose, filter, has, pathEq, pluck, prop } from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { toArray } from '../utils/array'
import { formatError } from '../utils/formatError'

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

const isErrorWhitelisted = (errors: any) => Array.isArray(errors) && any(
  pathEq(['extensions', 'code'], 'PERSISTED_QUERY_NOT_FOUND'),
  errors
)

export const error = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
  const {vtex: { account, workspace }} = ctx
  let parsedError: any

  try {
    await next()

    parsedError = parseErrorResponse(ctx.graphql.graphqlResponse || {})
  }
  catch (e) {
    if (e.isGraphQLError) {
      const response = JSON.parse(e.message)
      parsedError = parseError(response)
      ctx.body = response
    } else {
      parsedError = [formatError(e)]
      ctx.body = {errors: parsedError}
    }

    ctx.status = e.statusCode || 500
    if (e.headers) {
      Object.keys(e.headers).forEach(header => {
        ctx.set(header, e.headers[header])
      })
    }
  }
  finally {
    if (parsedError) {
      ctx.set('Cache-Control', 'no-cache, no-store')
      if (!isErrorWhitelisted(parsedError)) {
        try {
          ctx.clients.logger.error(parsedError)
        } catch (e) {
          console.error(e)
        }
        const message = parseMessage(parsedError)
        console.error(message.join('\n'))
        console.log(getSplunkQuery(account, workspace))
      }
    }
  }
}
