import axios from 'axios'

import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

export async function cancelationToken<T extends IOClients, U, V>(ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  if (ctx.method.toUpperCase() === ('GET' || 'OPTIONS' || 'HEAD')) {
    ctx.vtex.cancellation = {
      cancelable: true,
      cancelled: false,
      source: axios.CancelToken.source(),
    }
  }
  await next()
}
