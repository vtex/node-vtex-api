import TokenBucket from 'tokenbucket'
import { IOClients } from '../../../../clients/IOClients'
import { nameSpanOperationMiddleware } from '../../../tracing/tracingMiddlewares'
import { createPrivateHttpRoute } from '../http'
import {
  ClientsConfig,
  GraphQLOptions,
  ParamsContext,
  RecorderState,
  ServiceRoute,
} from '../typings'
import { injectGraphqlContext } from './middlewares/context'
import { graphqlError } from './middlewares/error'
import { extractQuery } from './middlewares/query'
import { response } from './middlewares/response'
import { run } from './middlewares/run'
import { upload } from './middlewares/upload'
import { makeSchema } from './schema'
import { GraphQLContext } from './typings'

export const GRAPHQL_ROUTE = '__graphql'

export const createGraphQLRoute = <T extends IOClients, U extends RecorderState, V extends ParamsContext>(
  graphql: GraphQLOptions<T, U, V>,
  clientsConfig: ClientsConfig<T>,
  serviceRoute: ServiceRoute,
  routeId: string,
  globalLimiter: TokenBucket | undefined
) => {
  const schema = makeSchema(graphql)
  const pipeline = [
    nameSpanOperationMiddleware('graphql-handler', GRAPHQL_ROUTE),
    injectGraphqlContext,
    response,
    graphqlError,
    upload,
    extractQuery(schema),
    run(schema),
  ]
  return createPrivateHttpRoute<T, U, V & GraphQLContext>(clientsConfig, pipeline, serviceRoute, routeId, globalLimiter)
}
