import { ServiceContext } from '../../typings/service'
import { hrToMillis } from './../../utils/time'

const statusLabel = (status: number) => `${Math.floor(status/100)}xx`

const log = (
  {vtex: {account, workspace, route: {id}}, url, method, status}: ServiceContext,
  millis: number,
) =>
  `${new Date().toISOString()}\t${account}/${workspace}:${id}\t${status}\t${method}\t${url}\t${millis}ms`

const production = process.env.VTEX_PRODUCTION === 'true'

export const logger = async (ctx: ServiceContext, next: (() => Promise<any>) | undefined) => {
  const start = process.hrtime()

  if (next) {
    await next()
  }

  const {
    __error: error,
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
    error,
    forwardedHost,
    forwardedPath,
    forwardedProto,
    method,
    millis,
    operationId,
    platform,
    production,
    requestId,
    routeId: id,
    status,
  }, logType)

  metrics.batch(`http-handler-${statusLabel(status)}-${id}`, end)
  console.log(log(ctx, millis))
}
