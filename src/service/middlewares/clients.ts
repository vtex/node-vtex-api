import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { ServiceContext } from '../../typings/service'

export const clients = <T extends IOClients>(ClientsImpl: ClientsImplementation<T>, clientOptions: Record<string, InstanceOptions>) =>
  async (ctx: ServiceContext<T>, next: (() => Promise<any>) | undefined) => {
    ctx.clients = new ClientsImpl(clientOptions, ctx)

    if (next) {
      await next()
    }
  }
