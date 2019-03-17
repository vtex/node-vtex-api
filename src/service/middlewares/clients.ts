import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'

import { ServiceContext } from '../typings'

export const clients = <T extends IOClients>(ClientsImpl: ClientsImplementation<T>, clientOptions: Record<string, InstanceOptions>) =>
  async (ctx: ServiceContext<T>, next: () => Promise<any>) => {
    ctx.clients = new ClientsImpl(clientOptions, ctx)

    await next()
  }
