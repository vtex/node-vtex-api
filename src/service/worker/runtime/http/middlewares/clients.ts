import {
  ClientsImplementation,
  IOClients,
} from '../../../../../clients/IOClients'
import { InstanceOptions } from '../../../../../HttpClient'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'

export function clients<
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
>(ClientsImpl: ClientsImplementation<T>, clientOptions: Record<string, InstanceOptions>) {
  return async function withClients(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
    if (ctx.serverTiming){
      ctx.vtex.serverTiming = ctx.serverTiming
    }
    clientOptions = {...clientOptions, apps: {
      ...clientOptions.apps,
      verbose: true,
    }}
    ctx.clients = new ClientsImpl(clientOptions, ctx.vtex)
    await next()
  }
}
