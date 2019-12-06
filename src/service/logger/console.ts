import { isMaster, isWorker } from 'cluster'

import { LRUCache } from '../../caches'
import { LogLevel } from './logger'

export interface LogMessage {
  cmd: typeof LOG_ONCE
  message: string,
  level: LogLevel
}

const history = new LRUCache<string, boolean>({
  max: 42,
})

export const LOG_ONCE = 'logOnce'

export const isLog = (message: any): message is LogMessage => message?.cmd === LOG_ONCE

export const log = (message: any, level: LogLevel) => {
  const logger = console[level]
  if (typeof logger === 'function') {
    logger(message)
  }
}

// Since we are now using clusters, if we simply console.log something,
// it may overwhelm the programmer's console with lots of repeated info.
// This function should be used when you want to warn about something
// only once
export const logOnceToDevConsole = (message: any, level: LogLevel): void => {
  const strigified = JSON.stringify(message)
  if (!history.has(strigified)) {
    history.set(strigified, true)

    if (isMaster) {
      log(message, level)
    }
    else if (isWorker && process.send) {
      const logMessage: LogMessage = {
        cmd: LOG_ONCE,
        level,
        message,
      }
      process.send(logMessage)
    }
  }
}
