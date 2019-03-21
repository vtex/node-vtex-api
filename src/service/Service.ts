import compose from 'koa-compose'
import { map } from 'ramda'

import { IOClients } from '../clients/IOClients'
import { EnvMetric, MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { timer } from '../utils/time'
import { addProcessListeners } from '../utils/unhandled'

import { clients } from './middlewares/clients'
import { error } from './middlewares/error'
import { logger } from './middlewares/logger'
import { RouteHandler, ServiceConfig } from './typings'

export class Service<ClientsT extends IOClients = IOClients, StateT = void, CustomT = void> {
  public routes: Record<string, RouteHandler<ClientsT, StateT, CustomT>>
  public statusTrack: () => EnvMetric[]

  constructor(config: ServiceConfig<ClientsT, StateT, CustomT>) {
    this.routes = map((handler: RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>) => {
      const middlewares = Array.isArray(handler) ? handler : [handler]
      const Clients = config.clients.implementation || IOClients
      return compose([clients(Clients, config.clients.options), logger, error, ...middlewares].map(timer))
    }, config.routes)

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
