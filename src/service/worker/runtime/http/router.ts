import { LogLevel } from '../../../logger'
import { logOnceToDevConsole } from './../../../logger/console'
import { ServiceRuntimeContext } from './../typings'

export const routerFromPublicHttpHandlers = (routes: Record<string, any>) => {
  return async (ctx: ServiceRuntimeContext, next: () => Promise<any>) => {
    const {
      headers: {
        COLOSSUS_ROUTE_ID_HEADER: routeId,
      },
    } = ctx

    if (!routeId) {
      return next()
    }

    const handler = routes[routeId]
    if (!handler) {
      const msg = `Handler with id '${routeId}' not implemented.`
      ctx.status = 501
      ctx.body = msg
      logOnceToDevConsole(msg, LogLevel.Error)
      return
    }

    await handler(ctx, next)
  }
}
