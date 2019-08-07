import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { EventHandler, RouteHandler } from '../typings'
import { composeForEvents } from '../utils/compose'
import { clients } from './middlewares/clients'
import { contextNormalizer } from './middlewares/contextNormalizer'
import { error } from './middlewares/error'
import { timings } from './middlewares/timings'

export const createEventHandler = <ClientsT extends IOClients, StateT>(
  Clients: ClientsImplementation<ClientsT>,
  options: Record<string, InstanceOptions>
) => {
  return (handler: EventHandler<ClientsT, StateT> | Array<EventHandler<ClientsT, StateT>>) => {
    const middlewares = Array.isArray(handler) ? handler : [handler]
    const pipeline = [contextNormalizer, clients(Clients, options), timings, error, ...middlewares]
    return composeForEvents(pipeline)
  }
}

