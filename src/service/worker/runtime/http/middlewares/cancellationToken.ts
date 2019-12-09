import axios from 'axios'

import { IOClients } from '../../../../../clients/IOClients'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'

export async function cancellationToken<
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
>(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  if (ctx.method.toUpperCase() === ('GET' || 'OPTIONS' || 'HEAD')) {
    ctx.vtex.cancellation = {
      cancelable: true,
      cancelled: false,
      source: axios.CancelToken.source(),
    }
  }
  await next()
}
