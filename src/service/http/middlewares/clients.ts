import { ClientsImplementation, IOClients } from '../../../clients/IOClients'
import { InstanceOptions } from '../../../HttpClient'
import { ServiceContext } from '../../typings'

export function clients<T extends IOClients, StateT>(ClientsImpl: ClientsImplementation<T>, clientOptions: Record<string, InstanceOptions>) {
  return async function withClients(ctx: ServiceContext<T,StateT>, next: () => Promise<any>) {
    ctx.vtex.serverTiming = ctx.serverTiming
    ctx.clients = new ClientsImpl(clientOptions, ctx.vtex)
    await next()
  }
}
