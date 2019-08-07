import { ClientsImplementation, IOClients } from '../../../clients/IOClients'
import { InstanceOptions } from '../../../HttpClient'
import { EventContext } from '../../typings'

export function clients<T extends IOClients, U>(ClientsImpl: ClientsImplementation<T>, clientOptions: Record<string, InstanceOptions>) {
  return async function withClients(ctx: EventContext<IOClients,U>, next: () => Promise<any>) {
    ctx.clients = new ClientsImpl(clientOptions, ctx.vtex)
    await next()
  }
}
