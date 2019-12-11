import { COLOSSUS_ROUTE_ID_HEADER } from '../../../../constants'
import { LogLevel } from '../../../logger'
import { ServiceContext } from '../typings'
import { logOnceToDevConsole } from './../../../logger/console'

export const routerFromPublicHttpHandlers = (routes: Record<string, any>) => {
  return async (ctx: ServiceContext, next: () => Promise<void>) => {
    const routeId = ctx.get(COLOSSUS_ROUTE_ID_HEADER)

    if (!routeId) {
      return next()
    }

    const handler = routes[routeId]?.handler
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
