import {HttpClient, InstanceOptions} from './HttpClient'

const routes = {
  Event: (sender: string, subject: string, route: string) => `/events/${sender}/${subject}/${route}`,
  Log: (sender: string, subject: string, level: string) => `/logs/${sender}/${subject}/${level}`,
}

export class Colossus {
  private http: HttpClient
  private requestId: string | null

  constructor (opts: InstanceOptions) {
    this.requestId = opts.requestId || null
    this.http = HttpClient.forWorkspace('colossus', opts)
  }

  private addRequestId (data: any) {
    const {requestId} = this
    return {
      requestId,
      data,
    }
  }

  sendLog = (sender: string, subject: string, message: any, level: string) => {
    return this.http.post(routes.Log(sender, subject, level), this.addRequestId(message))
  }

  sendEvent = (sender: string, subject: string, route: string, message?: any) => {
    return this.http.post(routes.Event(sender, subject, route), this.addRequestId(message))
  }
}
