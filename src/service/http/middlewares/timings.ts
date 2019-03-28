import { IOClients } from '../../../clients/IOClients'
import { statusLabel } from '../../../utils/status'
import { hrToMillis } from '../../../utils/time'
import { updateLastLogger } from '../../../utils/unhandled'
import { ServiceContext } from '../../typings'

const log = <T extends IOClients, U, V>(
  {vtex: {account, workspace, route: {id}}, path, method, status}: ServiceContext<T, U, V>,
  millis: number
) =>
  `${new Date().toISOString()}\t${account}/${workspace}:${id}\t${status}\t${method}\t${path}\t${millis}ms`

export async function timings<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const start = process.hrtime()

  updateLastLogger(ctx.clients.logger)

  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  const { status, vtex: { route: { id } } } = ctx
  const end = process.hrtime(start)
  const millis = hrToMillis(end)

  metrics.batch(`http-handler-${statusLabel(status)}-${id}`, end, { [status]: 1 })
  console.log(log(ctx, millis))
}
