import { constants } from 'os'

import { IOClients } from '../../clients/IOClients'
import { Logger } from '../../clients/Logger'
import { cleanError } from '../../utils/error'
import { hrToMillis } from '../../utils/time'

import { ServiceContext } from '../typings'

const statusLabel = (status: number) => `${Math.floor(status/100)}xx`

const log = <T extends IOClients, U, V>(
  {vtex: {account, workspace, route: {id}}, url, method, status}: ServiceContext<T, U, V>,
  millis: number
) =>
  `${new Date().toISOString()}\t${account}/${workspace}:${id}\t${status}\t${method}\t${url}\t${millis}ms`

// We can't log to Splunk without a token, so we are hacking our way into using
// the logger available from the last request cycle. ¯\_(ツ)_/¯
let lastLogger: Logger

export async function logger<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const start = process.hrtime()

  lastLogger = ctx.clients.logger
  let error

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

process.on('uncaughtException', async (err: Error) => {
  console.error('uncaughtException', err)
  await lastLogger.error(err, {
    type: 'uncaughtException',
    ...cleanError(err),
  })
  process.exit(420)
})

process.on('unhandledRejection', (reason: Error | any, promise: Promise<void>)  => {
  console.error('unhandledRejection', reason, promise)
  lastLogger.error(reason, {
    promise,
    type: 'unhandledRejection',
    ...cleanError(reason),
  }).catch(() => null)
})

process.on('warning', (warning) => {
  console.warn(warning)
})

// Remove the any typings once we move to nodejs 10.x
const handleSignal: any = async (signal: string) => {
  console.warn('Received signal', signal)
  await lastLogger.warn({
    signal,
  })
  // Default node behaviour
  process.exit(128 + (constants.signals as any)[signal])
}

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)
