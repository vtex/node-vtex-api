import {HttpClient, withoutRecorder} from '../HttpClient'
import {HttpClientFactory, IODataSource} from '../IODataSource'
import {cleanError} from '../utils/error'

const DEFAULT_SUBJECT = '-'
const production = process.env.VTEX_PRODUCTION === 'true'

const routes = {
  Log: (level: string) => `/logs/${level}`,
}

const forWorkspaceWithoutRecorder: HttpClientFactory = ({service, context, options}) => (service && context)
  ? HttpClient.forWorkspace(service, withoutRecorder(context), {...options, concurrency: 1})
  : undefined

export class Logger extends IODataSource {
  protected service = 'colossus'
  protected httpClientFactory = forWorkspaceWithoutRecorder

  public debug = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, 'debug')

  public info = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, 'info')

  public warn = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, 'warn')

  public error = (error: any, subject: string = DEFAULT_SUBJECT) => {
    if (!error) {
      error = new Error('Colossus.error was called with null or undefined error')
      error.code = 'ERR_NIL_ERR'
      console.error(error)
    }

    return this.sendLog(subject, cleanError(error), 'error')
  }

  public sendLog = (subject: string, message: any, level: string) : Promise<void> => {
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
