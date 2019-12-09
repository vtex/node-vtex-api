import { LogLevel } from '../../../logger'
import { RouteHandler, ServiceContext } from '../typings'
import { logOnceToDevConsole } from './../../../logger/console'

export const routerFromEventHandlers = (events: Record<string, RouteHandler> | null) => {
  return async (ctx: ServiceContext, next: () => Promise<void>) => {
    const {
      headers: {
        EVENT_HANDLER_ID_HEADER: handlerId,
      },
    } = ctx

    if (!handlerId || !events) {
      return next()
    }

    if (handlerId == null) {
      ctx.response.status = 400
      ctx.response.body = `Request header doesn't have the field x-event-handler-id`
      return
    }

    const handler = events[handlerId]
    if (!handler) {
      const msg = `Event handler not found for ${handlerId}`
      ctx.response.status = 404
      ctx.response.body = msg
      logOnceToDevConsole(msg, LogLevel.Error)
      return
    }

    await handler(ctx, next)
  }
}
