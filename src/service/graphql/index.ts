import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { createHttpRoute } from '../http'
import { GraphQLOptions, RouteHandler } from '../typings'
import { graphqlError } from './middlewares/error'
import { createFormatters } from './middlewares/formatters'
import { parseQuery } from './middlewares/query'
import { response } from './middlewares/response'
import { run } from './middlewares/run'
import { injectSchema } from './middlewares/schema'
import { graphqlTimings } from './middlewares/timings'
import { upload } from './middlewares/upload'
import { GraphQLContext, GraphQLServiceContext } from './typings'

export const GRAPHQL_ROUTE_LEGACY = '__graphql'
export const GRAPHQL_ROUTE = 'graphql'

export const createGraphQLRoute = <ClientsT extends IOClients, StateT, CustomT>(
    graphql: GraphQLOptions<ClientsT, StateT, CustomT>,
    Clients: ClientsImplementation<ClientsT>,
    options: Record<string, InstanceOptions>
  ): RouteHandler<ClientsT, StateT, CustomT> => {
    const injectGraphql = async (ctx: GraphQLServiceContext, next: () => Promise<void>) => {
      ctx.graphql = graphql as GraphQLOptions<IOClients, StateT, CustomT>
      await next()
      delete ctx.graphql
    }

    return createHttpRoute<ClientsT, StateT, CustomT & GraphQLContext>(Clients, options)([
      injectGraphql,
      graphqlTimings,
      graphqlError,
      upload,
      parseQuery,
      createFormatters,
      injectSchema,
      run,
      response,
    ]) as RouteHandler<ClientsT, StateT, CustomT>
}

export { graphqlRuntimeCacheStorage } from './middlewares/run'
