import { IOClients } from '../../../clients/IOClients'
import { LogLevel } from '../../../clients/Logger'
import { cleanError } from '../../../utils/error'
import { EventContext } from '../../typings'

export async function error<T extends IOClients, U> (ctx: EventContext<T, U>, next: () => Promise<any>) {
  try {
    await next()
  } catch (e) {
    console.error('[node-vtex-api error]', e)
    const err = cleanError(e)

    // Add response
    ctx.body = ctx.body || err

    // Log error
    const {
      vtex: {
        operationId,
        requestId,
      },
    } = ctx

    // Grab level from originalError, default to "error" level.
    let level = err && err.level as LogLevel
    if (!level || !(level === LogLevel.Error || level === LogLevel.Warn)) {
      level = LogLevel.Error
    }

    const log = {
      ...err,
      operationId,
      requestId,
    }

    // Use sendLog directly to avoid cleaning error twice.
    ctx.clients.logger.sendLog('-', log, level).catch((reason: any) => {
      console.error('Error logging error 🙄 retrying once...', reason ? reason.response : '')
      ctx.clients.logger.sendLog('-', log, level).catch()
    })
  }
}
