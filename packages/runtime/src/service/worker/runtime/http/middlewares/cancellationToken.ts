import axios from 'axios'

import { IOClients } from '@vtex/api'
import { cancellableMethods } from '../../../../../constants'
import { ParamsContext, RecorderState, ServiceContext } from '@vtex/api'

export async function cancellationToken<
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
>(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  if (cancellableMethods.has(ctx.method.toUpperCase())) {
    ctx.vtex.cancellation = {
      cancelable: true,
      cancelled: false,
      source: axios.CancelToken.source(),
    }
  }
  await next()
}
