import { mapObjIndexed } from 'ramda'

import { IOClients } from '../../../clients/IOClients'
import { ParamsContext, RecorderState, RouteHandler, ServiceContext } from './typings'
import { compose } from './utils/compose'

type HTTPMethods = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH' | 'DEFAULT'

type MethodOptions<
  ClientsT extends IOClients = IOClients,
  StateT extends RecorderState = RecorderState,
  CustomT extends ParamsContext = ParamsContext
> = Partial<
  Record<HTTPMethods, RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>>
>

const TEN_SECONDS_S = 10

function methodNotAllowed<T extends IOClients, U extends RecorderState, V extends ParamsContext>(
  ctx: ServiceContext<T, U, V>
) {
  ctx.status = 405
  ctx.set('cache-control', `public, max-age=${TEN_SECONDS_S}`)
}

export function method<T extends IOClients, U extends RecorderState, V extends ParamsContext>(
  options: MethodOptions<T, U, V>
) {
  const handlers = mapObjIndexed(
    handler => compose(Array.isArray(handler) ? handler : [handler]),
    options as Record<string, RouteHandler<T, U, V> | Array<RouteHandler<T, U, V>>>
  )

  const inner = async function forMethod(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
    const verb = ctx.method.toUpperCase()
    const handler = handlers[verb] || handlers.DEFAULT || methodNotAllowed

    if (handler) {
      await handler(ctx)
    }

    await next()
  }

  inner.skipTimer = true

  return inner
}
