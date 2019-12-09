import { RouteHandler, ServiceContext } from '../service/worker/runtime/typings'
import { IOClients } from './../clients/IOClients'

export function cancel<T extends IOClients, U, V>(middleware: RouteHandler<T, U, V>): RouteHandler<T, U, V> {
  return async (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) => {
    if(ctx.vtex?.cancellation?.cancelled) {
      return
    }
    await middleware(ctx, next)
  }
}
