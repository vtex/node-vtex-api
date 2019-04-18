import {IOClients} from '../clients/IOClients'
import {HttpClient, withoutRecorder} from '../HttpClient'
import {HttpClientFactory, IODataSource} from '../IODataSource'
import {ServiceContext} from '../service/typings'
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

  public error = <T extends IOClients, U, V>(error: any, subject: string = DEFAULT_SUBJECT, ctx?: ServiceContext<T, U, V>) => {
    if (!error) {
      error = new Error('Colossus.error was called with null or undefined error')
      error.code = 'ERR_NIL_ERR'
      console.error(error)
    }

    let log: any
    const cleanedError = cleanError(error)

    if (ctx) {
      const {
        method,
        status,
        vtex: {
          operationId,
          requestId,
          route: {
            id,
          },
        },
        headers: {
          'x-forwarded-path': forwardedPath,
          'x-forwarded-host': forwardedHost,
          'x-forwarded-proto': forwardedProto,
          'x-vtex-platform': platform,
        },
      } = ctx

      log = {
        ...cleanedError,
        forwardedHost,
        forwardedPath,
        forwardedProto,
        method,
        operationId,
        platform,
        requestId,
        routeId: id,
        status,
      }
    } else {
      log = cleanedError
    }

    return this.sendLog(subject, log, 'error').catch((reason) => {
      console.error('Error logging error 🙄 retrying once...', reason ? reason.response : '')
      this.sendLog(subject, log, 'error').catch()
    })
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
