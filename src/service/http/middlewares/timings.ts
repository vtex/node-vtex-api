import chalk from 'chalk'

import { IOClients } from '../../../clients/IOClients'
import { statusLabel } from '../../../utils/status'
import { formatTimingName, hrToMillis, reduceTimings, shrinkTimings } from '../../../utils/time'
import { ServiceContext } from '../../typings'

const APP_ELAPSED_TIME_LOCATOR = shrinkTimings(formatTimingName({
  hopNumber: 0,
  source: process.env.VTEX_APP_NAME!,
  target: '',
}))

const formatDate = (date: Date) => chalk.dim('[' + date.toISOString().split('T')[1] + ']')
const formatStatus = (status: number) => status >= 500 ? chalk.red(status.toString()) : (status >=200 && status < 300 ? chalk.green(status.toString()) : status)
const formatMillis = (millis: number) => millis >= 500 ? chalk.red(millis.toString()) : millis >= 200 ? chalk.yellow(millis.toString()) : chalk.green(millis.toString())

const log = <T extends IOClients, U, V>(
  {vtex: {account, workspace, route: {id}}, path, method, status}: ServiceContext<T, U, V>,
  millis: number
) =>
  `${formatDate(new Date())}\t${account}/${workspace}:${id}\t${formatStatus(status)}\t${method}\t${path}\t${formatMillis(millis)} ms`

export async function timings<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  const start = process.hrtime()

  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  const { status, vtex: { route: { id } } } = ctx
  const end = process.hrtime(start)
  const millis = hrToMillis(end)
  console.log(log(ctx, millis))

  metrics.batch(`http-handler-${statusLabel(status)}-${id}`, end, { [status]: 1 })

  if (ctx.serverTiming){
    ctx.serverTiming![APP_ELAPSED_TIME_LOCATOR] = `${millis}`
    // ctx.set('Server-Timing', reduceTimings(ctx.serverTiming!))
  }

}
