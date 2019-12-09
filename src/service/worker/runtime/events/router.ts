import { LogLevel } from '../../../logger'
import { logOnceToDevConsole } from './../../../logger/console'
import { ServiceRuntimeContext } from './../typings'

export const routerFromEventHandlers = (events: Record<string, any>) => {
  return async (ctx: ServiceRuntimeContext, next: () => Promise<any>) => {
    const {
      headers: {
        EVENT_HANDLER_ID_HEADER: handlerId,
      },
    } = ctx

    if (!handlerId) {
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
