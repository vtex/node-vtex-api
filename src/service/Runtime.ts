import { map } from 'ramda'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { EnvMetric, MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { addProcessListeners } from '../utils/unhandled'

import { createGraphQLRoute, GRAPHQL_ROUTE, GRAPHQL_ROUTE_LEGACY } from './graphql'
import { createHttpRoute } from './http'
import { Service } from './Service'
import { ClientsConfig, RouteHandler, ServiceDescriptor } from './typings'

const linked = !!process.env.VTEX_APP_LINK
const noop = () => []

const defaultClients: ClientsConfig = {
  options: {
    messages: {
      concurrency: 10,
      retries: 2,
      timeout: 1000,
    },
    messagesGraphQL: {
      concurrency: 10,
      retries: 2,
      timeout: 1000,
    },
  },
}

export class Runtime<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  public routes: Record<string, RouteHandler<ClientsT, StateT, CustomT>>
  public events: any
  public statusTrack: () => EnvMetric[]
  public __is_service: true = true // eslint-disable-line

  public constructor(
    service: Service<ClientsT, StateT, CustomT>,
    // eslint-disable-next-line
    descriptor: ServiceDescriptor,
  ) {
    const {config} = service
    const clients = {
      implementation: config.clients && config.clients.implementation || IOClients,
      options: {
        ...defaultClients.options,
        ...config.clients ? config.clients.options : null,
      },
    }

    const Clients = clients.implementation as ClientsImplementation<ClientsT>

    this.routes = config.routes
      ? map(createHttpRoute<ClientsT, StateT, CustomT>(Clients, clients.options), config.routes)
      : {}

    if (config.graphql) {
      let graphqlRoute = GRAPHQL_ROUTE
      if (descriptor.routes && descriptor.routes[GRAPHQL_ROUTE_LEGACY]) {
        console.warn('Using legacy graphql route id', GRAPHQL_ROUTE_LEGACY)
        graphqlRoute = GRAPHQL_ROUTE_LEGACY
      }
      this.routes[graphqlRoute] = createGraphQLRoute<ClientsT, StateT, CustomT>(config.graphql, Clients, clients.options)
    }

    this.events = config.events
    this.statusTrack = linked ? noop : global.metrics.statusTrack

    addProcessListeners()
  }
}

global.metrics = new MetricsAccumulator()

declare global {
  namespace NodeJS {
    interface Global {
      metrics: MetricsAccumulator
    }
  }
}
