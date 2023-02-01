import { constants } from 'os'

import { RequestCancelledError } from '../../errors/RequestCancelledError'
import { Logger } from '../logger'

export const logger = new Logger({account: 'unhandled', workspace: 'unhandled', requestId: 'unhandled', operationId: 'unhandled', production: process.env.VTEX_PRODUCTION === 'true'})
let watched: NodeJS.Process

const handleSignal: NodeJS.SignalsListener = signal => {
  process.exit((constants.signals as any)[signal])
}

export const addProcessListeners = () => {
  // Listeners already set up
  if (watched) {
    return
  }

  watched = process.on('uncaughtException', (err: any) => {
    console.error('uncaughtException', err)
    if (err && logger) {
      err.type = 'uncaughtException'
      logger.error(err)
    }
    process.exit(420)
  })

  process.on('unhandledRejection', (reason: Error | any, promise: Promise<void>)  => {
    if (reason instanceof RequestCancelledError) {
      return
    }
    console.error('unhandledRejection', reason, promise)
    if (reason && logger) {
      reason.type = 'unhandledRejection'
      logger.error(reason)
    }
  })

  process.on('warning', (warning) => {
    console.warn(warning)
  })

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
}
