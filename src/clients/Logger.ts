import { InfraClient, InstanceOptions } from '../HttpClient'
import { Logger as IOLogger } from '../service/logger'
import { IOContext } from '../service/typings'
import { cleanError } from '../utils/error'

const DEFAULT_SUBJECT = '-'
const production = process.env.VTEX_PRODUCTION === 'true'

export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

const routes = {
  Log: (level: LogLevel) => `/logs/${level}`,
}

export class Logger extends InfraClient {
  private logger: IOLogger

  constructor(context: IOContext, options?: InstanceOptions) {
    super('colossus', {...context, recorder: undefined}, {...options, concurrency: 1})
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

  public sendLog = (subject: string, message: any, level: LogLevel) : Promise<void> => {
    // Use stdout logger
    if (this.logger) {
      this.logger.log(message, level)
    }

    if (!message) {
      message = new Error('Logger.sendLog was called with null or undefined message')
      message.code = 'ERR_NIL_ERR'
      console.error(message)
    }

    if (typeof message === 'string' || message instanceof String) {
      message = {message}
    }

    if (message && typeof message === 'object') {
      message.production = production
    }

    return this.http.put(routes.Log(level), message, {params: {subject}, metric: 'logger-send'})
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
