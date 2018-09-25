import * as stringify from 'json-stringify-safe'

import {HttpClient, InstanceOptions, IOContext, withoutRecorder} from './HttpClient'

const DEFAULT_SUBJECT = '-'

const routes = {
  Event: (route: string) => `/events/${route}`,
  Log: (level: string) => `/logs/${level}`,
  Metric: () => `/metrics`,
}

const errorReplacer = (key: string, value: any) => {
  if (key.startsWith('_')) {
    return undefined
  }
  if (value && typeof value === 'string' && value.length > 1024) {
    return value.substr(0, 1024) + '[...TRUNCATED]'
  }
  return value
}

export class Colossus {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forWorkspace('colossus', withoutRecorder(ioContext), opts)
  }

  public debug = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, 'debug')

  public info = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, 'info')

  public warn = (message: any, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, 'warn')

  public error = (error: any, details: Record<string, any>, subject: string = DEFAULT_SUBJECT) => {
    if (!error) {
      error = new Error('Colossus.error was called with null or undefined error')
      error.code = 'ERR_NIL_ERR'
      console.error(error)
    }

    const {code: errorCode, message, stack, response, ...rest} = error
    const code = errorCode || response && `http-${response.status}`
    const d = response
      ? { response, ...details }
      : { stringified: stringify(rest, errorReplacer), ...details }

    this.sendLog(subject, {code, message, stack, details: d}, 'error')
  }

  public sendLog = (subject: string, message: any, level: string) => {
    return this.http.put(routes.Log(level), message, {params: {subject}})
  }

  public sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(routes.Event(route), message, {params: {subject}})
  }

  public sendMetric = (metric: BillingMetric) => {
    return this.http.post(routes.Metric(), metric)
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
    headers: Record<string, string>
  }
  // You might add any other keys with extra information
  [key: string]: any
}

export interface BillingMetric {
  value: number,
  unit: string,
  metricId: string,
  timestamp?: number,
}
