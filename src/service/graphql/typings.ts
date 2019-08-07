import { HttpQueryRequest } from 'apollo-server-core'
import { HttpQueryResponse } from 'apollo-server-core/dist/runHttpQuery'
import { GraphQLSchema } from 'graphql'
import { GraphQLResponse } from 'graphql-extensions'

import { IOClients } from '../../clients/IOClients'
import { GraphQLOptions, ServiceContext } from '../typings'

export interface GraphQLContext {
  graphql: GraphQLOptions<IOClients, any, any> & {
    schema?: GraphQLSchema
    query?: HttpQueryRequest['query']
    graphqlResponse?: GraphQLResponse
    responseInit?: HttpQueryResponse['responseInit']
    status?: 'success' | 'error'
    graphQLErrors?: any[]
    formatters?: {
      formatError: <T>(e: T) => T
      formatResponse: <T>(r: T) => T
    }
  }
}

export type GraphQLServiceContext = ServiceContext<
  IOClients,
  any,
  GraphQLContext
>
