import { HttpQueryRequest } from 'apollo-server-core'
import { HttpQueryResponse } from 'apollo-server-core/dist/runHttpQuery'
import { GraphQLSchema } from 'graphql'
import { GraphQLResponse } from 'graphql-extensions'
import { Middleware } from 'koa-compose'

import { IOClients } from '../../clients/IOClients'
import { GraphQLOptions, ServiceContext } from '../typings'

export interface GraphQLContext {
  graphql: GraphQLOptions<IOClients, any, any> & {
    schema?: GraphQLSchema
    query?: HttpQueryRequest['query']
    graphqlResponse?: GraphQLResponse
    responseInit?: HttpQueryResponse['responseInit']
    status?: 'success' | 'error'
    graphqlErrors?: any[]
  }
}

export type GraphQLServiceContext = ServiceContext<IOClients, any, GraphQLContext>
