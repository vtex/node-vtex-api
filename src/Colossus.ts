import {HttpClient, InstanceOptions, IOContext} from './HttpClient'

const routes = {
  Event: (route: string) => `/events/${route}`,
  Log: (level: string) => `/logs/${level}`,
  Metric: () => `/metrics`,
}

export class Colossus {
  private http: HttpClient
  private ctx: IOContext

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forWorkspace('colossus', ioContext, opts)
    this.ctx = ioContext
  }

  sendLog = (subject: string, message: any, level: string) => {
    return this.http.put(routes.Log(level), message, {params: {subject}})
  }

  sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(routes.Event(route), message, {params: {subject}})
  }

  sendMetric = (metric: BillingMetric) => {
    metric.production = this.ctx.production
    return this.http.post(routes.Metric(), metric)
  }
}

export type BillingMetric = {
  value: number,
  unit: string,
  production: boolean,
  timestamp: Date,
}