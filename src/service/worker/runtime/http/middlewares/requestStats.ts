import { IOClients } from '../../../../../clients/IOClients'
import { ParamsContext, RecorderState, ServiceContext } from '../../typings'

export const cancelMessage = 'Request cancelled'

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
const requestAborted = <
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
>(ctx: ServiceContext<T, U, V>) => () => {
  incomingRequestStats.aborted++

  if (ctx.vtex.cancellation && ctx.vtex.cancellation.cancelable) {
    ctx.vtex.cancellation.source.cancel(cancelMessage)
    ctx.vtex.cancellation.cancelled = true
  }
}

export async function trackIncomingRequestStats <
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
> (ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  ctx.req.on('close', requestClosed)
  ctx.req.on('aborted', requestAborted(ctx))
  incomingRequestStats.total++
  
  // Report total requests to diagnostics metrics (cumulative counter)
  const { status: statusCode, vtex: { route: { id, type } } } = ctx
  if (global.diagnosticsMetrics) {
    global.diagnosticsMetrics.incrementCounter('http_server_requests_total', 1, {
      route_id: id,
      route_type: type,
      status_code: statusCode,
    })
  } else {
    console.warn('DiagnosticsMetrics not available. Request total metric not reported.')
  }
  
  await next()
}
