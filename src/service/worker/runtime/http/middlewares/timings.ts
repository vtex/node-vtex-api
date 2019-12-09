import chalk from 'chalk'

import { IOClients } from '../../../../../clients/IOClients'
import { APP, LINKED, PID } from '../../../../../constants'
import { statusLabel } from '../../../../../utils/status'
import {
  formatTimingName,
  hrToMillis,
  reduceTimings,
  shrinkTimings,
} from '../../../../../utils/time'
import { IOContext, ServiceContext } from '../../typings'

const APP_ELAPSED_TIME_LOCATOR = shrinkTimings(formatTimingName({
  hopNumber: 0,
  source: process.env.VTEX_APP_NAME!,
  target: '',
}))

const pid = chalk.magenta('[' + PID + ']')
const formatDate = (date: Date) => chalk.dim('[' + date.toISOString().split('T')[1] + ']')
const formatStatus = (status: number) => status >= 500 ? chalk.red(status.toString()) : (status >=200 && status < 300 ? chalk.green(status.toString()) : status)
const formatMillis = (millis: number) => millis >= 500 ? chalk.red(millis.toString()) : millis >= 200 ? chalk.yellow(millis.toString()) : chalk.green(millis.toString())

const log = <T extends IOClients, U, V>(
  { vtex: { account, workspace, route: { id } }, path, method, status }: ServiceContext<T, U, V>,
  millis: number
) =>
  `${formatDate(new Date())}\t${pid}\t${account}/${workspace}:${id}\t${formatStatus(status)}\t${method}\t${path}\t${formatMillis(millis)} ms`

const logBillingInfo = (
  { account, workspace, production, route: { id, type } }: IOContext,
  millis: number
) => JSON.stringify({
  '__VTEX_IO_BILLING': 'true',
  'account': account,
  'app': APP.ID,
  'handler': id,
  'isLink': LINKED,
  'production': production,
  'routeType': type === 'public' ? 'public_route' : 'private_route',
  'type': 'process-time',
  'value': millis,
  'vendor': APP.VENDOR,
  'workspace': workspace,
})

export async function timings<T extends IOClients, U, V> (ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  const { status: statusCode, vtex: { route: { id } }, timings: {total}, vtex } = ctx
  const totalMillis = hrToMillis(total)
  console.log(log(ctx, totalMillis))
  console.log(logBillingInfo(vtex, totalMillis))

  const status = statusLabel(statusCode)
  // Only batch successful responses so metrics don't consider errors
  metrics.batch(`http-handler-${id}`, status === 'success' ? total : undefined, { [status]: 1 })

  if (ctx.serverTiming){
    ctx.serverTiming[APP_ELAPSED_TIME_LOCATOR] = `${totalMillis}`
    ctx.set('Server-Timing', reduceTimings(ctx.serverTiming!))
  }
}
