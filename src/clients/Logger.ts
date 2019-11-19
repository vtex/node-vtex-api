import { InfraClient, InstanceOptions } from '../HttpClient'
import { Logger as IOLogger } from '../service/logger'
import { IOContext } from '../service/typings'
import { cleanError } from '../utils/error'

const DEFAULT_SUBJECT = '-'

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

export class Logger extends InfraClient {
  private logger: IOLogger

  constructor(context: IOContext, options?: InstanceOptions) {
    super('colossus@0.x', {...context, recorder: undefined}, {...options, concurrency: 1})
    this.logger = context.logger!
  }

  public debug = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, LogLevel.Debug)

  public info = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, LogLevel.Info)

  public warn = (warning: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, cleanError(warning), LogLevel.Warn)

  public error = (error: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, cleanError(error), LogLevel.Error)

  public sendLog = (_: string, message: any, level: LogLevel) : Promise<void> => {
    // Use stdout logger
    if (this.logger) {
      this.logger.log(message, level)
    }

    // Deprecate logging to colossus
    console.warn('Logger in ctx.clients.logger is deprecated, please use ctx.vtex.logger instead.')
    return Promise.resolve()
  }
}

export interface ErrorLog {
  // Consistent accross many errors of the same type
  code: string
  // User-facing message, may vary by error
  message: string
  // Axios-compatible error format
  response?: {
    status: number
    data: string
    headers: Record<string, string>,
  }
  // You might add any other keys with extra information
  [key: string]: any
}
