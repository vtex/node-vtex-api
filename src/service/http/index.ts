import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { RouteHandler } from '../typings'
import { compose } from '../utils/compose'
import { clients } from './middlewares/clients'
import { error } from './middlewares/error'
import { removeSetCookie } from './middlewares/setCookie'
import { timings } from './middlewares/timings'

export const createHttpRoute = <ClientsT extends IOClients, StateT, CustomT>(
  Clients: ClientsImplementation<ClientsT>,
  options: Record<string, InstanceOptions>
) => {
  return (handler: RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>) => {
    const middlewares = Array.isArray(handler) ? handler : [handler]
    const pipeline = [clients(Clients, options), timings, error, removeSetCookie, ...middlewares]
    return compose(pipeline)
  }
}
