import { map } from 'ramda'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { EnvMetric, MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { addProcessListeners } from '../utils/unhandled'

import { createGraphQLRoute, GRAPHQL_ROUTE } from './graphql'
import { createHttpRoute } from './http'
import { Service } from './Service'
import { ClientsConfig, RouteHandler, ServiceDescriptor } from './typings'

const defaultClients: ClientsConfig = {
  implementation: IOClients,
  options: {},
}

console.log('require @vtex/api 3.0.3-beta.3 Runtime')

export class Runtime<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  public routes: Record<string, RouteHandler<ClientsT, StateT, CustomT>>
  public events: any
  public statusTrack: () => EnvMetric[]
  public __is_service: true = true // tslint:disable-line

  constructor(
    service: Service<ClientsT, StateT, CustomT>,
    // tslint:disable-next-line
    descriptor: ServiceDescriptor,
  ) {

    console.log('@vtex/api 3.0.3-beta.3 Runtime', service, descriptor)
    const {config} = service
    const clients = {
      ...defaultClients,
      ...config.clients,
    }

    const Clients = clients.implementation as ClientsImplementation<ClientsT>

    this.routes = config.routes
      ? map(createHttpRoute<ClientsT, StateT, CustomT>(Clients, clients.options), config.routes)
      : {}

    if (config.graphql) {
      this.routes[GRAPHQL_ROUTE] = createGraphQLRoute<ClientsT, StateT, CustomT>(config.graphql, Clients, clients.options)
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
