import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { createHttpRoute } from '../http'
import { GraphQLOptions, RouteHandler } from '../typings'
import { injectGraphqlContext } from './middlewares/context'
import { graphqlError } from './middlewares/error'
import { extractQuery } from './middlewares/query'
import { response } from './middlewares/response'
import { run } from './middlewares/run'
import { upload } from './middlewares/upload'
import { makeSchema } from './schema'
import { GraphQLContext } from './typings'

export const GRAPHQL_ROUTE_LEGACY = '__graphql'
export const GRAPHQL_ROUTE = 'graphql'

export const createGraphQLRoute = <ClientsT extends IOClients, StateT, CustomT>(
    graphql: GraphQLOptions<ClientsT, StateT, CustomT>,
    Clients: ClientsImplementation<ClientsT>,
    options: Record<string, InstanceOptions>
  ): RouteHandler<ClientsT, StateT, CustomT> => {

    const schema = makeSchema(graphql)

    return createHttpRoute<ClientsT, StateT, CustomT & GraphQLContext>(Clients, options)([
      injectGraphqlContext,
      response,
      graphqlError,
      upload,
      extractQuery(schema),
      run(schema),
    ]) as RouteHandler<ClientsT, StateT, CustomT>
}
