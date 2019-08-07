import { constants } from 'os'

import { Logger } from '../clients'

// We can't log to Splunk without a token, so we are hacking our way into using
// the logger available from the last request cycle. ¯\_(ツ)_/¯
let lastLogger: Logger
let watched: NodeJS.Process

// Remove the any typings once we move to nodejs 10.x
const handleSignal: any = async (signal: string) => {
  console.warn('Received signal', signal)
  if (lastLogger) {
    await lastLogger.warn({
      signal,
    })
  }
  // Default node behaviour
  process.exit(128 + (constants.signals as any)[signal])
}

export const updateLastLogger = (logger: Logger) => {
  lastLogger = logger
}

export const addProcessListeners = () => {
  // Listeners already set up
  if (watched) {
    return
  }

  watched = process.on('uncaughtException', async (err: any) => {
    console.error('uncaughtException', err)
    if (err && lastLogger) {
      err.type = 'uncaughtException'
      await lastLogger.error(err).catch(() => null)
    }
    process.exit(420)
  })

  process.on(
    'unhandledRejection',
    (reason: Error | any, promise: Promise<void>) => {
      console.error('unhandledRejection', reason, promise)
      if (reason && lastLogger) {
        reason.type = 'unhandledRejection'
        lastLogger.error(reason).catch(() => null)
      }
    }
  )

  process.on('warning', warning => {
    console.warn(warning)
  })

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)
}
