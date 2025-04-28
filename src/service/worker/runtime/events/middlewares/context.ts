import { IOClients } from '../../../../../clients/IOClients'
import {
  HeaderKeys,
} from '../../../../../constants'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'
import { prepareHandlerCtx } from '../../utils/context'

export async function eventContextMiddleware <T extends IOClients, U extends RecorderState, V extends ParamsContext>(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  const { request: { header } } = ctx
  ctx.vtex = {
    ...prepareHandlerCtx(header, ctx.tracing),
    eventInfo: {
      key: header[HeaderKeys.EVENT_KEY],
      sender: header[HeaderKeys.EVENT_SENDER],
      subject: header[HeaderKeys.EVENT_SUBJECT],
    },
    route: {
      id: header[HeaderKeys.EVENT_HANDLER_ID],
      params: {},
      type: 'event',
    },
  }
  await next()
}
