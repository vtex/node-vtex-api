import { map } from 'ramda'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { EnvMetric, MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { addProcessListeners } from '../utils/unhandled'
import { InstanceOptions } from './../HttpClient/typings'
import { createEventHandler } from './events'
import {
  createGraphQLRoute,
  GRAPHQL_ROUTE,
  GRAPHQL_ROUTE_LEGACY,
} from './graphql'
import { createHttpRoute } from './http'
import { LogLevel, logOnceToDevConsole } from './logger'
import { Service } from './Service'
import { ClientsConfig, ParsedServiceDescriptor, RouteHandler } from './typings'

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

const scaleClientCaches = (
  scaleFactor: number,
  options: Record<string, InstanceOptions>
) => Object.entries(options).forEach(([name, opts]) => {
  if (opts && opts.memoryCache && scaleFactor > 1) {
    const previous = (opts.memoryCache as any).storage.max
    const current = previous / scaleFactor;
    (opts.memoryCache as any).storage.max = current
    logOnceToDevConsole(`Scaling ${name} cache capacity from ${previous} to ${current}`, LogLevel.Warn)
  }
})

export class Runtime<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  public routes: Record<string, RouteHandler<ClientsT, StateT, CustomT>>
  public events: any
  public statusTrack: () => EnvMetric[]
  public __is_service: true = true // tslint:disable-line

  constructor(
    service: Service<ClientsT, StateT, CustomT>,
    // tslint:disable-next-line
    descriptor: ParsedServiceDescriptor,
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

    scaleClientCaches(descriptor.workers, clients.options)

    this.routes = config.routes
      ? map(createHttpRoute<ClientsT, StateT, CustomT>(Clients, clients.options), config.routes)
      : {}

    if (config.graphql) {
      let graphqlRoute = GRAPHQL_ROUTE
      if (descriptor.routes && descriptor.routes[GRAPHQL_ROUTE_LEGACY]) {
        logOnceToDevConsole(`Using legacy graphql route id ${GRAPHQL_ROUTE_LEGACY}`, LogLevel.Warn)
        graphqlRoute = GRAPHQL_ROUTE_LEGACY
      }
      this.routes[graphqlRoute] = createGraphQLRoute<ClientsT, StateT, CustomT>(config.graphql, Clients, clients.options)
    }

    this.events = config.events
      ? map(createEventHandler<ClientsT, StateT, CustomT>(Clients, clients.options), config.events)
      : {}

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
