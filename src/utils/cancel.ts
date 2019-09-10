import { RouteHandler, ServiceContext } from '../service/typings'
import { IOClients } from './../clients/IOClients'

export function cancel<T extends IOClients, U, V>(middleware: RouteHandler<T, U, V>): RouteHandler<T, U, V> {
  return async (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) => {

    if (!ctx.vtex.cancelation) {
      return await next()
    }

    if (ctx.vtex.cancelation.canceled) {
      return
    }

    return await next()
  }
}
