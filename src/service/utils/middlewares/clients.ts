import { ClientsImplementation, IOClients } from '../../../clients/IOClients'
import { InstanceOptions } from '../../../HttpClient'
import { EventServiceContext, ServiceContext } from '../../typings'

export function clients<T extends IOClients, U, V>(ClientsImpl: ClientsImplementation<T>, clientOptions: Record<string, InstanceOptions>) {
  return async function withClients(ctx: ServiceContext<T, U, V> | EventServiceContext<T, U, V>, next: () => Promise<any>) {
    ctx.clients = new ClientsImpl(clientOptions, ctx.vtex)
    await next()
  }
}
