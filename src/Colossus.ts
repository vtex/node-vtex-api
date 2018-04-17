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

  sendMetrics = (subject: string, message?: any) => {
    const {
      account: accountName,
      workspace,
      sender: appId,
      production
    } = this.ctx

    const metricMessage = JSON.stringify({
      ...message,
      accountName,
      data: {
        workspace,
        appId,
        production
      },
      timestamp: +(new Date())
    })
    return this.http.put(routes.Metric(), message, {params: {subject}})
  }
}
