import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

class IncomingRequestStats {
  public aborted = 0
  public closed = 0
  public total = 0

  public get () {
    return {
      aborted: this.aborted,
      closed: this.closed,
      total: this.total,
    }
  }

  public clear () {
    this.aborted = 0
    this.closed = 0
    this.total = 0
  }
}

export const incomingRequestStats = new IncomingRequestStats()

const requestClosed = () => {
  incomingRequestStats.closed++
}
const requestAborted = () => {
  incomingRequestStats.aborted++
}

export async function trackIncomingRequestStats <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  ctx.req.on('close', requestClosed)
  ctx.req.on('aborted', requestAborted)
  incomingRequestStats.total++
  await next()
}
