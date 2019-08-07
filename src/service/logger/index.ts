import { IOContext } from '../../service/typings'
import { cleanError } from '../../utils/error'

const production = process.env.VTEX_PRODUCTION === 'true'
const app = process.env.VTEX_APP_ID
const EMPTY_MESSAGE = 'Logger.sendLog was called with null or undefined message'

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

export class Logger {
  private account: string
  private workspace: string
  private operationId: string
  private requestId: string

  constructor(ctx: Partial<IOContext>) {
    this.account = ctx.account!
    this.workspace = ctx.workspace!
    this.requestId = ctx.requestId!
    this.operationId = ctx.operationId!
  }

  public debug = (message: any) =>
    this.log(message, LogLevel.Debug)

  public info = (message: any) =>
    this.log(message, LogLevel.Info)

  public warn = (warning: any) =>
    this.log(cleanError(warning), LogLevel.Warn)

  public error = (error: any) =>
    this.log(cleanError(error), LogLevel.Error)

  public log = (message: any, level: LogLevel): void => {
    /* tslint:disable:object-literal-sort-keys */
    console.log(JSON.stringify({
      __VTEX_IO_LOG: true,
      app,
      account: this.account,
      workspace: this.workspace,
      production,
      data: message || EMPTY_MESSAGE,
      operationId: this.operationId,
      requestId: this.requestId,
      level,
    }))
  }
}
