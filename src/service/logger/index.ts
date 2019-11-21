import { isMaster, isWorker } from 'cluster'

import { IOContext } from '../../service/typings'
import { cleanError } from '../../utils/error'
import { LRUCache } from './../../caches/LRUCache'

const linked = !!process.env.VTEX_APP_LINK
const app = process.env.VTEX_APP_ID
const EMPTY_MESSAGE = 'Logger.log was called with null or undefined message'

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

export const log = (message: any, level: LogLevel) => {
  const logger = console[level]
  if (typeof logger === 'function') {
    logger(message)
  }
}

export class Logger {
  private account: string
  private workspace: string
  private operationId: string
  private requestId: string
  private production: boolean
  private history: LRUCache<string, boolean> = new LRUCache({
    max: 42,
  })

  constructor(ctx: Pick<IOContext, 'account'|'workspace'|'requestId'|'operationId'|'production'>) {
    this.account = ctx.account
    this.workspace = ctx.workspace
    this.requestId = ctx.requestId
    this.operationId = ctx.operationId
    this.production = ctx.production
  }

  public debug = (message: any) =>
    this.log(message, LogLevel.Debug)

  public info = (message: any) =>
    this.log(message, LogLevel.Info)

  public warn = (warning: any) =>
    this.log(warning, LogLevel.Warn)

  public error = (error: any) =>
    this.log(error, LogLevel.Error)

  public log = (message: any, level: LogLevel): void => {
    const data = message ? cleanError(message) : EMPTY_MESSAGE
    /* tslint:disable:object-literal-sort-keys */
    console.log(JSON.stringify({
      __VTEX_IO_LOG: true,
      level,
      app,
      account: this.account,
      workspace: this.workspace,
      production: this.production,
      data,
      operationId: this.operationId,
      requestId: this.requestId,
    }))

    // Warn the developer how to retrieve the error in splunk
    this.logSplunkQuery()
  }

  // Since we are now using clusters, if we simply console.log something,
  // it may overwhelm the programmer's console with lots of repeated info.
  // This function should be used when you want to warn about something
  // only once
  public logOnce = (message: any, level: LogLevel): void => {
    const strigified = JSON.stringify(message)
    if (!this.history.has(strigified)) {
      this.history.set(strigified, true)

      if (isMaster) {
        log(message, level)
      }
      else if (isWorker && process.send) {
        process.send({
          message,
          level,
          cmd: 'logOnce',
        })
      }
    }
  }

  /**
   * Logs splunk query so the developer can search for the errors in splunk.
   * This function runs only once in the lifetime of the Logger class so we
   * don't mess up with the developer's terminal
   */
  private logSplunkQuery = () => {
    if (linked) {
      const message = `Try this query at Splunk to retrieve error log: 'index=io_vtex_logs app="${app}" account=${this.account} workspace=${this.workspace} level=error OR level=warn'`
      this.logOnce(message, LogLevel.Info)
    }
  }
}
