import bodyParse from 'co-body'

import { IOClients } from '../../../../../clients/IOClients'
import { LogLevel } from '../../../../logger'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'
import { logOnceToDevConsole } from './../../../../logger/console'

export async function parseBodyMiddleware <T extends IOClients, U extends RecorderState, V extends ParamsContext>(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  try {
    ctx.state.body = await bodyParse(ctx.req)
  } catch (err) {
    const msg = `Error parsing event body: ${err.message || err}`
    ctx.status = 500
    ctx.body = msg
    logOnceToDevConsole(msg, LogLevel.Error)
    return
  }
  await next()
}
