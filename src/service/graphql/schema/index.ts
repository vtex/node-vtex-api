import { readFileSync } from 'fs-extra'
import { GraphQLSchema } from 'graphql'
import { makeExecutableSchema } from 'graphql-tools'
import { any, keys, map, zipObj } from 'ramda'

import { GraphQLServiceContext } from '../typings'
import { messagesLoader } from './messagesLoader'
import { nativeSchemaDirectives } from './schemaDirectives'
import { nativeResolvers, nativeTypeDefs, scalarResolversMap, shouldNotCacheWhenSchemaHas } from './typeDefs'

export type SchemaMetaData = Record<string, boolean>

interface Cache {
  executableSchema: GraphQLSchema | null
  schemaMetaData: SchemaMetaData | null
  typeDefs: string | null
}

const cache: Cache = {
  executableSchema: null,
  schemaMetaData: null,
  typeDefs: null,
}

let appTypeDefs: string | undefined

try{
  appTypeDefs = readFileSync('./service/schema.graphql', 'utf8')
// eslint-disable-next-line no-empty
} catch (err) {}

export const makeSchema = (ctx: GraphQLServiceContext) => {
  const {
    graphql: { resolvers: appResolvers,
      schemaDirectives: appDirectives,
    },
    clients: { segment },
    vtex: { locale },
  } = ctx

  if (cache.executableSchema) {
    return cache.executableSchema
  }

  const schemaMetaData = extractSchemaMetaData(appTypeDefs!)

  // The target translation locale is only necessary if this GraphQL app uses the `IOMessage` resolver.
  const getLocaleTo = async () => {
    if (locale) {
      return locale
    }
    const { cultureInfo } = await segment.getSegment()
    return cultureInfo
  }

  const resolverContext = {
    getLocaleTo,
    translationsLoader: messagesLoader(ctx.clients),
  }

  const executableSchema = makeExecutableSchema({
    resolvers: {
      ...appResolvers,
      ...nativeResolvers(resolverContext),
    },
    schemaDirectives: {
      ...appDirectives,
      ...nativeSchemaDirectives,
    },
    typeDefs: getOrSetTypeDefs(schemaMetaData),
  })

  if (isSchemaCacheable(schemaMetaData)) {
    cache.executableSchema = executableSchema
  }

  return executableSchema
}

const getOrSetTypeDefs = (schemaMetaData: SchemaMetaData) => {
  if (!cache.typeDefs) {
    cache.typeDefs = [
      appTypeDefs,
      nativeTypeDefs(schemaMetaData),
    ].join('\n\n')
  }
  return cache.typeDefs
}

const hasScalar = (typeDefs: string) => (scalar: string) =>
  new RegExp(`scalar(\\s)+${scalar}(\\s\\n)+`).test(typeDefs)

const extractSchemaMetaData = (typeDefs: string) => {
  if (!cache.schemaMetaData) {
    const scalars = keys(scalarResolversMap)
    const scalarsPresentInSchema = map(hasScalar(typeDefs), scalars)
    cache.schemaMetaData = zipObj(scalars, scalarsPresentInSchema)
  }
  return cache.schemaMetaData
}

const isSchemaCacheable = (schemaMetaData: SchemaMetaData) => !any(scalar => schemaMetaData[scalar], shouldNotCacheWhenSchemaHas)
