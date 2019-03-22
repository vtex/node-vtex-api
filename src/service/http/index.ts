import compose from 'koa-compose'

import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { timer } from '../../utils/time'
import { clients } from './../middlewares/clients'
import { error } from './../middlewares/error'
import { logger } from './../middlewares/logger'
import { RouteHandler } from './../typings'

export const createHttpRoute = <ClientsT extends IOClients, StateT, CustomT>(
  Clients: ClientsImplementation<ClientsT>,
  options: Record<string, InstanceOptions>
) => {
  return (handler: RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>) => {
    const middlewares = Array.isArray(handler) ? handler : [handler]
    return compose([clients(Clients, options), logger, error, ...middlewares].map(timer))
  }
}
