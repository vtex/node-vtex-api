import { json } from 'co-body'
import { DocumentNode, GraphQLSchema, parse as gqlParse, validate } from 'graphql'
import { parse } from 'url'
import { ExecutableSchema } from './../typings'

import { BODY_HASH } from '../../../../../constants'
import { GraphQLServiceContext, Query } from '../typings'
import { LRUCache } from './../../../../../caches/LRUCache'

const documentStorage = new LRUCache<string, DocumentNode>({
  max: 500,
})

const queryFromUrl = (url: string) => {
  const parsedUrl = parse(url, true)
  const { query: querystringObj } = parsedUrl

  // Having a BODY_HASH means the query is in the body
  if (querystringObj && querystringObj[BODY_HASH]) {
    return null
  }

  // We need to JSON.parse the variables since they are a stringified
  // in the querystring
  if (querystringObj && typeof querystringObj.variables === 'string') {
    querystringObj.variables = JSON.parse(querystringObj.variables)
  }

  return querystringObj
}

const parseAndValidateQueryToSchema = (query: string, schema: GraphQLSchema) => {
  const document = gqlParse(query)
  const validation = validate(schema, document)
  if (Array.isArray(validation) && validation.length > 0) {
    throw validation
  }
  return document
}

export const extractQuery = (executableSchema: ExecutableSchema) =>
  async function parseAndValidateQuery(ctx: GraphQLServiceContext, next: () => Promise<void>) {
    const { request, req } = ctx

    let query: Query & { query: string }
    if (request.is('multipart/form-data')) {
      query = (request as any).body
    } else if (request.method.toUpperCase() === 'POST') {
      query = await json(req, { limit: '3mb' })
    } else {
      query = queryFromUrl(request.url) || (await json(req, { limit: '3mb' }))
    }

    // Assign the query before setting the query.document because if the
    // validation fails we don't loose the query in our error log
    ctx.graphql.query = query

    query.document = (await documentStorage.getOrSet(query.query, async () => ({
      value: parseAndValidateQueryToSchema(query.query, executableSchema.schema),
    }))) as DocumentNode

    await next()
  }
