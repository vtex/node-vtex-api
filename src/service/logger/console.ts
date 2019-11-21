import { isMaster, isWorker } from 'cluster'

import { LRUCache } from '../../caches'
import { LogLevel } from './logger'

const history = new LRUCache<string, boolean>({
  max: 42,
})

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
      process.send({
        cmd: 'logOnce',
        level,
        message,
      })
    }
  }
}
