import { APP, LOG_CLIENT_INIT_TIMEOUT_MS, AttributeKeys } from '../../constants'
import { cleanError } from '../../utils/error'
import { cleanLog } from '../../utils/log'
import { Types } from '@vtex/diagnostics-nodejs'
import { LoggerContext, LogLevel, TracingState } from './loggerTypes'
import { getLogClient } from './client'

const app = APP.ID
const EMPTY_MESSAGE = 'Logger.log was called with null or undefined message'

export class Logger {
  private account: string
  private workspace: string
  private operationId: string
  private requestId: string
  private production: boolean
  private tracingState?: TracingState
  private logClient: Types.LogClient | undefined = undefined
  private clientInitPromise: Promise<Types.LogClient | undefined> | undefined = undefined

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

    this.initLogClient()
  }

  private initLogClient(): Promise<Types.LogClient | undefined> {
    if (this.clientInitPromise) {
      return this.clientInitPromise
    }

    this.clientInitPromise = (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Log client initialization timeout')), LOG_CLIENT_INIT_TIMEOUT_MS)
        })

        this.logClient = await Promise.race([
          getLogClient(),
          timeoutPromise,
        ])

        return this.logClient
      } catch (error) {
        console.error('Failed to initialize log client:', error)
        return undefined
      }
    })()

    return this.clientInitPromise
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

    cleanLog(data)

    /* tslint:disable:object-literal-sort-keys */
    const commonLogFields = {
      __VTEX_IO_LOG: true,
      level,
      operationId: this.operationId,
      requestId: this.requestId,
      ... (this.tracingState?.isTraceSampled ? { traceId: this.tracingState.traceId } : null),
    }

    const inflatedLog = {
      app,
      account: this.account,
      workspace: this.workspace,
      production: this.production,
      data,
      ...commonLogFields,
    }

    // Mark third-party apps logs to send to skidder
    if (APP.IS_THIRD_PARTY()) {
      Object.assign(inflatedLog, {
        '__SKIDDER_TOPIC_1': `skidder.vendor.${APP.VENDOR}`,
        '__SKIDDER_TOPIC_2': `skidder.app.${APP.VENDOR}.${APP.NAME}`,
      })
    }

    console.log(JSON.stringify(inflatedLog))

    const diagnosticsLog = {
      [AttributeKeys.VTEX_IO_APP_ID]: app,
      [AttributeKeys.VTEX_ACCOUNT_NAME]: this.account,
      [AttributeKeys.VTEX_IO_WORKSPACE_NAME]: this.workspace,
      [AttributeKeys.VTEX_IO_WORKSPACE_TYPE]: this.production ? 'production' : 'development',
      [AttributeKeys.VTEX_IO_APP_AUTHOR_TYPE]: APP.IS_THIRD_PARTY() ? '3p' : '1p',
      ...commonLogFields,
    }

    if (this.logClient) {
      try {
        const logMessage = typeof data === 'string' ? data : JSON.stringify(data)
        switch (level) {
          case LogLevel.Debug:
            this.logClient.debug(logMessage, diagnosticsLog)
            break
          case LogLevel.Info:
            this.logClient.info(logMessage, diagnosticsLog)
            break
          case LogLevel.Warn:
            this.logClient.warn(logMessage, diagnosticsLog)
            break
          case LogLevel.Error:
            this.logClient.error(logMessage, diagnosticsLog)
            break
          default:
            this.logClient.info(logMessage, diagnosticsLog)
        }
      } catch (e) {
        console.error('Error using diagnostics client for logging:', e)
      }
    }

  }
}
