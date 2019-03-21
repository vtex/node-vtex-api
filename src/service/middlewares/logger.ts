import { IOClients } from '../../clients/IOClients'
import { hrToMillis } from '../../utils/time'
import { updateLastLogger } from '../../utils/unhandled'

import { ServiceContext } from '../typings'

const statusLabel = (status: number) => `${Math.floor(status/100)}xx`

const log = <T extends IOClients, U, V>(
  {vtex: {account, workspace, route: {id}}, url, method, status}: ServiceContext<T, U, V>,
  millis: number
) =>
  `${new Date().toISOString()}\t${account}/${workspace}:${id}\t${status}\t${method}\t${url}\t${millis}ms`


export async function logger<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const start = process.hrtime()
  let error

  updateLastLogger(ctx.clients.logger)

  try {
    await next()
  } catch (e) {
    error = e
  } finally {
    const {
      method,
      status,
      vtex: {
        route: {
          id,
        },
      },
      headers: {
        'x-request-id': requestId,
        'x-operation-id': operationId,
        'x-forwarded-path': forwardedPath,
        'x-forwarded-host': forwardedHost,
        'x-forwarded-proto': forwardedProto,
        'x-vtex-platform': platform,
      },
    } = ctx
    const end = process.hrtime(start)
    const millis = hrToMillis(end)
    const logType = error ? 'error' : 'info'

    ctx.clients.logger.sendLog('-', {
      ... error ? error : null,
      forwardedHost,
      forwardedPath,
      forwardedProto,
      method,
      millis,
      operationId,
      platform,
      requestId,
      routeId: id,
      status,
    }, logType)

    metrics.batch(`http-handler-${statusLabel(status)}-${id}`, end)
    console.log(log(ctx, millis))
  }
}
