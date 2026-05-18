import { readFileSync } from 'fs-extra'
import { makeExecutableSchema } from 'graphql-tools'
import { keys, map, zipObj } from 'ramda'

import { IOClients } from '../../../../../clients/IOClients'
import { GraphQLOptions, ParamsContext, RecorderState } from '../../typings'
import { nativeSchemaDirectives, nativeSchemaDirectivesTypeDefs } from './schemaDirectives'
import { nativeResolvers, nativeTypeDefs } from './typeDefs'

export type SchemaMetaData = Record<string, boolean>

const mergeTypeDefs = (appTypeDefs: string, schemaMetaData: SchemaMetaData) =>
  [appTypeDefs, nativeTypeDefs(schemaMetaData), nativeSchemaDirectivesTypeDefs].join('\n\n')

const hasScalar = (typeDefs: string) => (scalar: string) => new RegExp(`scalar(\\s)+${scalar}(\\s\\n)+`).test(typeDefs)

const extractSchemaMetaData = (typeDefs: string) => {
  const scalars = keys(nativeResolvers)
  const scalarsPresentInSchema = map(hasScalar(typeDefs), scalars)
  return zipObj(scalars, scalarsPresentInSchema)
}

export const makeSchema = <
  ClientsT extends IOClients = IOClients,
  StateT extends RecorderState = RecorderState,
  CustomT extends ParamsContext = ParamsContext
>(
  options: GraphQLOptions<ClientsT, StateT, CustomT>
) => {
  const { resolvers: appResolvers, schema: appSchema, schemaDirectives: appDirectives } = options
  const appTypeDefs = appSchema || readFileSync('./service/schema.graphql', 'utf8')

  const schemaMetaData = extractSchemaMetaData(appTypeDefs!)

  const executableSchema = makeExecutableSchema({
    resolvers: {
      ...appResolvers,
      ...nativeResolvers,
    },
    schemaDirectives: {
      ...appDirectives,
      ...nativeSchemaDirectives,
    },
    typeDefs: mergeTypeDefs(appTypeDefs, schemaMetaData),
  })

  return { schema: executableSchema, hasProvider: appSchema ? true : false }
}
