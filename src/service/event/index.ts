import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { EventHandler } from '../typings'
import { eventCompose } from '../utils/compose'
import { clients } from '../utils/middlewares/clients'
import { error } from './middlewares/error'
import { timings } from './middlewares/timings'

export const createEvent = <ClientsT extends IOClients, StateT, CustomT>(
  Clients: ClientsImplementation<ClientsT>,
  options: Record<string, InstanceOptions>
) => {
  return (handler: EventHandler<ClientsT, StateT, CustomT> | Array<EventHandler<ClientsT, StateT, CustomT>>) => {
    const middlewares = Array.isArray(handler) ? handler : [handler]
    const pipeline = [clients(Clients, options), timings, error, ...middlewares]
    return eventCompose(pipeline)
  }
}
