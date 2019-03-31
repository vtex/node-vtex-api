import { ClientsImplementation, IOClients } from '../../../clients/IOClients'
import { ClientsConfigOptions, ServiceContext, } from '../../typings'

export function clients<T extends IOClients, U, V>(ClientsImpl: ClientsImplementation<T>, clientOptions: ClientsConfigOptions<T>) {
  return async function withClients(ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
    ctx.clients = new ClientsImpl(clientOptions, ctx.vtex)
    await next()
  }
}
