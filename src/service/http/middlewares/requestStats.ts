import { IOClients } from '../../../clients/IOClients'
import { ServiceContext } from '../../typings'

class IncomingRequestStats {
  public aborted = 0
  public closed = 0
  public total = 0

  public get () {
    const ret = {
      aborted: this.aborted,
      closed: this.closed,
      total: this.total,
    }
    console.error('ret=', ret)
    return ret
  }

  public clear () {
    this.aborted = 0
    this.closed = 0
    this.total = 0
  }
}

export const incomingRequestStats = new IncomingRequestStats()

const requestClosed = () => {
  console.error(`${(new Date()).getTime()} api close`)
  incomingRequestStats.closed++
}
const requestAborted = () => {
  console.error(`${(new Date()).getTime()} api aborted`)
  incomingRequestStats.aborted++
}

export async function trackIncomingRequestStats <T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  ctx.req.on('close', requestClosed)
  ctx.req.on('aborted', requestAborted)
  incomingRequestStats.total++
  await next()
}
