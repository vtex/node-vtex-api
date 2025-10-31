import chalk from 'chalk'
import { Attributes } from '@opentelemetry/api'

import { IOClients } from '../../../../../clients/IOClients'
import { APP, LINKED, PID } from '../../../../../constants'
import { statusLabel } from '../../../../../utils/status'
import {
  formatTimingName,
  hrToMillis,
  reduceTimings,
  shrinkTimings,
} from '../../../../../utils/time'
import {
  IOContext,
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '../../typings'

const APP_ELAPSED_TIME_LOCATOR = shrinkTimings(formatTimingName({
  hopNumber: 0,
  source: process.env.VTEX_APP_NAME!,
  target: '',
}))

const pid = chalk.magenta('[' + PID + ']')
const formatDate = (date: Date) => chalk.dim('[' + date.toISOString().split('T')[1] + ']')
const formatStatus = (status: number) => status >= 500 ? chalk.red(status.toString()) : (status >=200 && status < 300 ? chalk.green(status.toString()) : status)
const formatMillis = (millis: number) => millis >= 500 ? chalk.red(millis.toString()) : millis >= 200 ? chalk.yellow(millis.toString()) : chalk.green(millis.toString())

const log = <
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
>(
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
  'timestamp': Date.now(),
  'type': 'process-time',
  'value': millis,
  'vendor': APP.VENDOR,
  'workspace': workspace,
})

export async function timings <
  T extends IOClients,
  U extends RecorderState,
  V extends ParamsContext
> (ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  const { status: statusCode, vtex: { route: { id, type } }, timings: {total}, vtex } = ctx
  const totalMillis = hrToMillis(total)
  console.log(log(ctx, totalMillis))
  console.log(logBillingInfo(vtex, totalMillis))

  const status = statusLabel(statusCode)
  
  // Legacy metrics (backward compatibility)
  // Only batch successful responses so metrics don't consider errors
  metrics.batch(`http-handler-${id}`, status === 'success' ? total : undefined, { [status]: 1 })

  // New diagnostics metrics with stable names and attributes
  if (global.diagnosticsMetrics) {
    const attributes: Attributes = {
      component: 'http-handler',
      route_id: id,
      route_type: type,
      status_code: statusCode,
      status,
    }

    // Record latency histogram (record all requests, not just successful ones)
    global.diagnosticsMetrics.recordLatency(total, attributes)

    // Increment counter (status is an attribute, not in metric name)
    global.diagnosticsMetrics.incrementCounter('http_handler_requests_total', 1, attributes)
  } else {
    console.warn('DiagnosticsMetrics not available. HTTP handler metrics not reported.')
  }
}
