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
  | 'DEFAULT'

// tslint:disable-next-line:no-empty
const emptyNext = async () => {}

type Options<
  ClientsT extends IOClients = IOClients,
  StateT = void,
  CustomT = void
> = Partial<
  Record<
    HTTPMethods,
    | RouteHandler<ClientsT, StateT, CustomT>
    | Array<RouteHandler<ClientsT, StateT, CustomT>>
  >
>

export function method<
  ClientsT extends IOClients = IOClients,
  StateT = void,
  CustomT = void
>(options: Options<ClientsT, StateT, CustomT>) {
  return async (
    ctx: ServiceContext<ClientsT, StateT, CustomT>,
    next: () => Promise<any>
  ) => {
    const verb = ctx.method.toUpperCase()
    const handler =
      (options as Partial<
        Record<
          string,
          | RouteHandler<ClientsT, StateT, CustomT>
          | Array<RouteHandler<ClientsT, StateT, CustomT>>
        >
      >)[verb] || options.DEFAULT

    if (Array.isArray(handler)) {
      await compose(handler)(ctx)
    } else if (handler) {
      await handler(ctx, emptyNext)
    }

    await next()
  }
}
