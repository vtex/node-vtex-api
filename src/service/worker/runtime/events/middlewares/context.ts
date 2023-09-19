import { IOClients } from '../../../../../clients/IOClients'
import {
  EVENT_HANDLER_ID_HEADER,
  EVENT_KEY_HEADER,
  EVENT_SENDER_HEADER,
  EVENT_SUBJECT_HEADER,
} from '../../../../../constants'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'
import { prepareHandlerCtx } from '../../utils/context'

export async function eventContextMiddleware <T extends IOClients, U extends RecorderState, V extends ParamsContext>(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  const { request: { header } } = ctx
  ctx.vtex = {
    ...prepareHandlerCtx(header, ctx.tracing),
    eventInfo: {
      key: header[EVENT_KEY_HEADER],
      sender: header[EVENT_SENDER_HEADER],
      subject: header[EVENT_SUBJECT_HEADER],
    },
    route: {
      id: header[EVENT_HANDLER_ID_HEADER],
      params: {},
      type: 'event',
    },
  }
  await next()
}
