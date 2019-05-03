import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

class IncomingRequestStats {
  public closed = 0
  public total = 0

  public get() {
    return {
      closed: this.closed,
      total: this.total,
    }
  }

  public clear() {
    this.closed = 0
    this.total = 0
  }
}

export const incomingRequestStats = new IncomingRequestStats()

const requestClosed = () => {
  incomingRequestStats.closed++
}

export async function trackIncomingRequestStats<T extends IOClients, U, V>(
  ctx: ServiceContext<T, U, V>,
  next: () => Promise<any>
) {
  ctx.req.on('close', requestClosed)
  incomingRequestStats.total++
  await next()
}
