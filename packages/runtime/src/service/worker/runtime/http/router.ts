import { HeaderKeys } from '../../../../constants'
import { LogLevel } from '@vtex/api'
import type { HttpRoute, ServiceContext } from '@vtex/api'
import { logOnceToDevConsole } from '@vtex/api'

export const routerFromPublicHttpHandlers = (routes: Record<string, HttpRoute>) => {
  return async (ctx: ServiceContext, next: () => Promise<void>) => {
    const routeId = ctx.get(HeaderKeys.COLOSSUS_ROUTE_ID)
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
