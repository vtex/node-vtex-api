import { constants } from 'os'

import { Logger } from '../service/logger'

const logger = new Logger({account: 'unhandled', workspace: 'unhandled', requestId: 'unhandled', operationId: 'unhandled'})
let watched: NodeJS.Process

// Remove the any typings once we move to nodejs 10.x
const handleSignal: any = (signal: string) => {
  console.warn('Received signal', signal)
  logger.warn({
    signal,
  })
  // Default node behaviour
  process.exit(128 + (constants.signals as any)[signal])
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
