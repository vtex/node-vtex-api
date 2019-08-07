import { IOClients } from '../../../clients/IOClients'
import { formatTimingName, hrToMillis, reduceTimings, shrinkTimings } from '../../../utils/time'
import { updateLastLogger } from '../../../utils/unhandled'
import { EventContext } from '../../typings'

const APP_ELAPSED_TIME_LOCATOR = shrinkTimings(formatTimingName({
  hopNumber: 0,
  source: process.env.VTEX_APP_NAME!,
  target: '',
}))

const log = <T extends IOClients, U>(
  {event:{sender}, vtex: {account, workspace}}: EventContext<T, U>,
  millis: number
) => `${new Date().toISOString()}\t${account}/${workspace}\t${millis}ms\t caller: ${sender}`


export async function timings<T extends IOClients, U> (ctx: EventContext<T,U>, next: () => Promise<any>) {
  const start = process.hrtime()

  updateLastLogger(ctx.clients.logger)

  // Errors will be caught by the next middleware so we don't have to catch.
  await next()

  const end = process.hrtime(start)
  const millis = hrToMillis(end)
  console.log(log(ctx, millis))
  metrics.batch(`event-handler`, end)
}
