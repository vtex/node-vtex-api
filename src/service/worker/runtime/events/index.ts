import { IOClients } from '../../../../clients/IOClients'
import { clients } from '../http/middlewares/clients'
import { error } from '../http/middlewares/error'
import { timings } from '../http/middlewares/timings'
import {
  ClientsConfig,
  EventHandler,
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '../typings'
import { compose, composeForEvents } from '../utils/compose'
import { toArray } from '../utils/toArray'
import { parseBodyMiddleware } from './middlewares/body'
import { eventContextMiddleware } from './middlewares/context'

export const createEventHandler = <T extends IOClients, U extends RecorderState, V extends ParamsContext>(
  clientsConfig: ClientsConfig<T>,
  handler: EventHandler<T, U> | Array<EventHandler<T, U>>
) => {
  const { implementation, options } = clientsConfig
  const middlewares = toArray(handler)
  const pipeline = [
    eventContextMiddleware,
    parseBodyMiddleware,
    clients<T, U, V>(implementation!, options),
    timings,
    error,
    contextAdapter<T, U, V>(middlewares),
  ]
  return compose(pipeline)
}

function contextAdapter<T extends IOClients, U extends RecorderState, V extends ParamsContext> (middlewares: Array<EventHandler<T, U>>) {
  return  async function  middlewareCascade(ctx: ServiceContext<T, U, V>) {
    const ctxEvent = {
      body: (ctx.state as any).body,
      clients: ctx.clients,
      key: ctx.vtex.eventInfo? ctx.vtex.eventInfo.key : '',
      metrics: ctx.metrics,
      sender: ctx.vtex.eventInfo? ctx.vtex.eventInfo.sender : '',
      state: ctx.state,
      subject: ctx.vtex.eventInfo? ctx.vtex.eventInfo.subject : '',
      timings: ctx.timings,
      vtex: ctx.vtex,
    }
    await composeForEvents<T, U>(middlewares)(ctxEvent)
    ctx.status = 204
  }
}
