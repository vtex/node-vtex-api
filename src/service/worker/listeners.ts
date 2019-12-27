import { constants } from 'os'

import { UNCAUGHT_EXCEPTION } from '../../constants'
import { RequestCancelledError } from '../../errors/RequestCancelledError'
import { Logger } from '../logger'

export const logger = new Logger({account: 'unhandled', workspace: 'unhandled', requestId: 'unhandled', operationId: 'unhandled', production: process.env.VTEX_PRODUCTION === 'true'})
let watched: NodeJS.Process

// Remove the any typings once we move to nodejs 10.x
const handleSignal: NodeJS.SignalsListener = signal => {
  const message = `Worker ${process.pid} received signal ${signal}`
  console.warn(message)
  logger.warn({message, signal})
  process.exit(constants.signals[signal])
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
    process.exitCode = UNCAUGHT_EXCEPTION
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
