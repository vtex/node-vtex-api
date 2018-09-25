import {HttpClient, InstanceOptions, IOContext, withoutRecorder} from './HttpClient'

const DEFAULT_SUBJECT = '-'

const routes = {
  Event: (route: string) => `/events/${route}`,
  Log: (level: string) => `/logs/${level}`,
  Metric: () => `/metrics`,
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

  public error = (message: ErrorLog, subject: string = DEFAULT_SUBJECT) =>
    this.sendLog(subject, message, 'error')

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
