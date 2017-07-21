import {HttpClient, InstanceOptions} from './HttpClient'

const routes = {
  Event: (sender: string, subject: string, route: string) => `/events/${sender}/${subject}/${route}`,
  Log: (sender: string, subject: string, level: string) => `/logs/${sender}/${subject}/${level}`,
}

export class Colossus {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('colossus', opts)
  }

  sendLog = (sender: string, subject: string, message: any, level: string) => {
    return this.http.post(routes.Log(sender, subject, level), message)
  }

  sendEvent = (sender: string, subject: string, route: string, message?: any) => {
    return this.http.post(routes.Event(sender, subject, route), message)
  }
}
