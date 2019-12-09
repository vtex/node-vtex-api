import { DocumentNode, execute } from 'graphql'

import { IOClients } from '../../../../clients/IOClients'
import { ServiceContext } from '../typings'

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

export interface GraphQLContext {
  graphql: {
    query?: Query
    graphqlResponse?: GraphQLResponse
    status: 'success' | 'error'
    cacheControl: GraphQLCacheControl
  }
}

export type GraphQLServiceContext = ServiceContext<IOClients, any, GraphQLContext>
