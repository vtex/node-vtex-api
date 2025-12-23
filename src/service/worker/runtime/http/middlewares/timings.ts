import chalk from 'chalk'
import { Attributes } from '@opentelemetry/api'

import { IOClients } from '../../../../../clients/IOClients'
import { APP, AttributeKeys, LINKED, PID } from '../../../../../constants'
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
  const { vtex: { route: { id, type } }, vtex } = ctx

  // Set base attributes for all metrics recorded during this request.
  // This includes metrics recorded by VTEX IO apps during handler execution.
  // These attributes will be automatically merged with custom attributes.
  const baseAttributes: Attributes = {
    [AttributeKeys.VTEX_ACCOUNT_NAME]: vtex.account,
    component: 'http-handler',
    route_id: id,
    route_type: type,
  }

  // Wrap the request handling with base attributes context.
  // All metrics recorded during next() will automatically include these attributes.
  const executeWithBaseAttributes = async () => {
    // Errors will be caught by the next middleware so we don't have to catch.
    await next()

    const { status: statusCode, timings: {total} } = ctx
    const totalMillis = hrToMillis(total)
    console.log(log(ctx, totalMillis))
    console.log(logBillingInfo(vtex, totalMillis))

    const status = statusLabel(statusCode)
    
    // Legacy metrics (backward compatibility)
    // Only batch successful responses so metrics don't consider errors
    metrics.batch(`http-handler-${id}`, status === 'success' ? total : undefined, { [status]: 1 })

    // New diagnostics metrics with stable names and attributes
    // Note: base attributes (account, route_id, route_type) are automatically merged
    // We only need to provide the response-specific attributes here
    if (global.diagnosticsMetrics) {
      const responseAttributes: Attributes = {
        status_code: statusCode,
        status,
      }

      // Record latency histogram (record all requests, not just successful ones)
      global.diagnosticsMetrics.recordLatency(total, responseAttributes)

      // Increment counter (status is an attribute, not in metric name)
      global.diagnosticsMetrics.incrementCounter('http_handler_requests_total', 1, responseAttributes)
    } else {
      console.warn('DiagnosticsMetrics not available. HTTP handler metrics not reported.')
    }
  }

  // If diagnosticsMetrics is available, run with base attributes context
  // Otherwise, run without context (fallback for graceful degradation)
  if (global.diagnosticsMetrics) {
    await global.diagnosticsMetrics.runWithBaseAttributes(baseAttributes, executeWithBaseAttributes)
  } else {
    console.warn('DiagnosticsMetrics not available. HTTP handler metrics not reported.')
    await executeWithBaseAttributes()
  }
}
