import { json } from 'co-body'
import { compose, partialRight, prop } from 'ramda'
import { parse, Url } from 'url'
import { GRAPHQL_BODY_HASH } from '../../../constants'
import { GraphQLServiceContext } from '../typings'


const parseVariables = (query: any) => {
  if (query && query[GRAPHQL_BODY_HASH]) {
    return null
  }
  if (query && typeof query.variables === 'string') {
    query.variables = JSON.parse(query.variables)
  }
  return query
}

const queryFromUrl = compose<string, Url, string, Record<string, any>>(
  parseVariables,
  prop<any, any>('query'),
  partialRight(parse, [true])
)

export async function parseQuery (ctx: GraphQLServiceContext, next: () => Promise<void>) {
  const {request, req} = ctx

  let query: Record<string, any>
  if (request.is('multipart/form-data')) {
    query = (request as any).body
  } else if (request.method.toUpperCase() === 'POST') {
    query = await json(req)
  } else {
    query = queryFromUrl(request.url) || await json(req)
  }

  ctx.graphql.query = query

  await next()
}
