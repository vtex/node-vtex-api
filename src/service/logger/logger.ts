import { APP } from '../../constants'
import { IUserLandTracer } from '../../tracing'
import { cleanError } from '../../utils/error'
import { IOContext } from '../worker/runtime/typings'
import { logOnceToDevConsole } from './console'

const linked = !!process.env.VTEX_APP_LINK
const app = APP.ID
const EMPTY_MESSAGE = 'Logger.log was called with null or undefined message'

export interface LoggerTracingContext {
  requestTracer: IUserLandTracer
}

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

interface LoggerContext extends  Pick<IOContext, 'account'|'workspace'|'requestId'|'operationId'|'production'> {
  tracer?: IOContext['tracer']
}

interface TracingState {
  isTraceSampled: boolean,
  traceId: string
}

export class Logger {
  private account: string
  private workspace: string
  private operationId: string
  private requestId: string
  private production: boolean
  private tracingState?: TracingState

  constructor(ctx: LoggerContext) {
    this.account = ctx.account
    this.workspace = ctx.workspace
    this.requestId = ctx.requestId
    this.operationId = ctx.operationId
    this.production = ctx.production

    if(ctx.tracer) {
      this.tracingState = {
        isTraceSampled: ctx.tracer.isTraceSampled,
        traceId: ctx.tracer.traceId,
      }
    }
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
    const inflatedLog = {
      __VTEX_IO_LOG: true,
      level,
      app,
      account: this.account,
      workspace: this.workspace,
      production: this.production,
      data,
      operationId: this.operationId,
      requestId: this.requestId,
      ... (this.tracingState?.isTraceSampled ? { traceId: this.tracingState.traceId } : null),
    }

    // Mark third-party apps logs to send to skidder
    if (APP.IS_THIRD_PARTY()) {
      Object.assign(inflatedLog, {
        __SKIDDER_TOPIC_1: `skidder.vendor.${APP.VENDOR}`,
        __SKIDDER_TOPIC_2: `skidder.app.${APP.VENDOR}.${APP.NAME}`,
      })
    }

    console.log(JSON.stringify(inflatedLog))

    // Warn the developer how to retrieve the error in splunk
    this.logSplunkQuery()
  }

  /**
   * Logs splunk query so the developer can search for the errors in splunk.
   * This function runs only once in the lifetime of the Logger class so we
   * don't mess up with the developer's terminal
   */
  private logSplunkQuery = () => {
    if (linked) {
      const message = `Try this query at Splunk to retrieve error log: 'index=io_vtex_logs app="${app}" account=${this.account} workspace=${this.workspace} level=error OR level=warn'`
      logOnceToDevConsole(message, LogLevel.Info)
    }
  }
}
