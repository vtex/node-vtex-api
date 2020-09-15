import { DocumentNode, execute, GraphQLSchema } from 'graphql'

import { IOClients } from '../../../../clients/IOClients'
import { ParamsContext, RecorderState, ServiceContext } from '../typings'

export interface Query {
  variables?: Record<string, any>
  operationName?: string
  document: DocumentNode
}

type TypeFromPromise<T> = T extends Promise<infer U> ? U : T

export type GraphQLResponse = TypeFromPromise<ReturnType<typeof execute>>

export interface GraphQLCacheControl {
  maxAge: number
  scope: 'private' | 'public' | 'segment'
  noCache: boolean
  noStore: boolean
}

export interface GraphQLContext extends ParamsContext {
  graphql: {
    query?: Query
    graphqlResponse?: GraphQLResponse
    status: 'success' | 'error'
    cacheControl: GraphQLCacheControl
  }
}

export type GraphQLServiceContext = ServiceContext<IOClients, RecorderState, GraphQLContext>

export interface ExecutableSchema {
  schema: GraphQLSchema
  hasProvider: boolean
  provider?: string
}
