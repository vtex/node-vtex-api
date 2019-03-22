import { map } from 'ramda'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { EnvMetric, MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { addProcessListeners } from '../utils/unhandled'

import { createGraphQLRoute, GRAPHQL_ROUTE } from './graphql'
import { createHttpRoute } from './http'
import { RouteHandler, RuntimeConfig, ServiceConfig } from './typings'

export class Service<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> implements RuntimeConfig<ClientsT, StateT, CustomT>{
  public routes: Record<string, RouteHandler<ClientsT, StateT, CustomT>>
  public events: any
  public statusTrack: () => EnvMetric[]
  public __is_service: true = true // tslint:disable-line

  constructor(config: ServiceConfig<ClientsT, StateT, CustomT>) {
    const Clients = (config.clients.implementation || IOClients) as ClientsImplementation<ClientsT>

    this.routes = map(createHttpRoute<ClientsT, StateT, CustomT>(Clients, config.clients.options), config.routes)

    if (config.graphql) {
      this.routes[GRAPHQL_ROUTE] = createGraphQLRoute<ClientsT, StateT, CustomT>(config.graphql, Clients, config.clients.options)
    }

    this.events = config.events
    this.statusTrack = global.metrics.statusTrack

    addProcessListeners()
  }
}

if (!global.metrics) {
  global.metrics = new MetricsAccumulator()
}

declare global {
  namespace NodeJS {
    interface Global {
      metrics: MetricsAccumulator
    }
  }
}
