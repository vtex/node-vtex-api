import compose, { Middleware } from 'koa-compose'
import { map } from 'ramda'

import { ClientsImplementation, IOClients } from '../clients/IOClients'
import { InstanceOptions } from '../HttpClient'
import { EnvMetric, MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { timer } from '../utils/time'

import { clients } from './middlewares/clients'
import { error } from './middlewares/error'
import { logger } from './middlewares/logger'
import { ServiceContext } from './typings'

export type RouteHandler = (ctx: ServiceContext, next: () => Promise<void>) => Promise<void>

export interface ClientsConfig<T extends IOClients> {
  implementation?: ClientsImplementation<T>
  options: Record<string, InstanceOptions>
}

export interface ServiceConfig<T extends IOClients> {
  routes: Record<string, Middleware<ServiceContext<T>> | Array<Middleware<ServiceContext<T>>>>
  clients: ClientsConfig<T>
}

export class Service<T extends IOClients = IOClients> {
  public routes: Record<string, Middleware<ServiceContext<T>>>
  public statusTrack: () => EnvMetric[]

  constructor(config: ServiceConfig<T>) {
    this.routes = map((handler: Middleware<ServiceContext<T>> | Array<Middleware<ServiceContext<T>>>) => {
      const middlewares = Array.isArray(handler) ? handler : [handler]
      const Clients = config.clients.implementation || IOClients
      return compose([clients(Clients, config.clients.options), logger, error, ...middlewares].map(timer))
    }, config.routes)

    this.statusTrack = global.metrics.statusTrack
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
