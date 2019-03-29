import { IOClients } from '../clients/IOClients'
import { RouteHandler, ServiceContext } from './typings'
import { compose } from './utils/compose'

type HTTPMethods =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'CONNECT'
  | 'OPTIONS'
  | 'TRACE'
  | 'PATCH'

const TEN_SECONDS_S = 10

const defaultHandler = <
  ClientsT extends IOClients = IOClients,
  StateT = void,
  CustomT = void
>(
  ctx: ServiceContext<ClientsT, StateT, CustomT>
) => {
  ctx.status = 405
  ctx.set('cache-control', `public, max-age=${TEN_SECONDS_S}`)
}

// tslint:disable-next-line:no-empty
const emptyNext = async () => {}

type Options<
  ClientsT extends IOClients = IOClients,
  StateT = void,
  CustomT = void
> = Record<
  HTTPMethods,
  | RouteHandler<ClientsT, StateT, CustomT>
  | Array<RouteHandler<ClientsT, StateT, CustomT>>
>

export function switcher<
  ClientsT extends IOClients = IOClients,
  StateT = void,
  CustomT = void
>(options: Options<ClientsT, StateT, CustomT>) {
  return async (
    ctx: ServiceContext<ClientsT, StateT, CustomT>,
    next: () => Promise<any>
  ) => {
    const { method } = ctx
    const verb = method.toUpperCase()
    const handler =
      (options as Record<
        string,
        | RouteHandler<ClientsT, StateT, CustomT>
        | Array<RouteHandler<ClientsT, StateT, CustomT>>
      >)[verb] || defaultHandler

    if (Array.isArray(handler)) {
      await compose(handler)(ctx)
    } else if (handler) {
      // tslint:disable-next-line:no-empty
      await handler(ctx, emptyNext)
    }

    await next()
  }
}
