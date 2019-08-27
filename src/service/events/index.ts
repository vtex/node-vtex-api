import { merge, pick } from 'ramda'
import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { clients } from '../http/middlewares/clients'
import { error } from '../http/middlewares/error'
import { timings } from '../http/middlewares/timings'
import { EventHandler, ServiceContext } from '../typings'
import { composeForEvents } from '../utils/compose'

export const createEventHandler = <ClientsT extends IOClients, StateT, CustomT>(
  Clients: ClientsImplementation<ClientsT>,
  options: Record<string, InstanceOptions>
) => {
  return (handler: EventHandler<ClientsT, StateT> | Array<EventHandler<ClientsT, StateT>>) => {
    const middlewares = Array.isArray(handler) ? handler : [handler]
    const pipeline = [clients(Clients, options), timings, error, contextAdapter<ClientsT, StateT, CustomT>(middlewares) ]
    return composeForEvents(pipeline)
  }
}

function contextAdapter<ClientsT extends IOClients, StateT, CustomT> (middlewares: Array<EventHandler<ClientsT, StateT>>) {
  return  async function  middlewareCascate(ctx: ServiceContext<ClientsT, StateT, CustomT>){
    const ctxEvent: any = merge(
      pick(['clients', 'state', 'vtex', 'timings', 'metrics', 'body'], ctx),
      {
        key: ctx.vtex.eventInfo? ctx.vtex.eventInfo.key : '',
        sender: ctx.vtex.eventInfo? ctx.vtex.eventInfo.sender : '',
        subject: ctx.vtex.eventInfo? ctx.vtex.eventInfo.subject : '',
      }
    )
    await composeForEvents(middlewares)(ctxEvent)
  }
}
