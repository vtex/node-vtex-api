import {HttpClient, InstanceOptions} from './HttpClient'

const routes = {
  Event: (route: string) => `/events/${route}`,
  Log: (level: string) => `/logs/${level}`,
}

export class Colossus {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('colossus', opts)
  }

  sendLog = (subject: string, message: any, level: string) => {
    return this.http.put(routes.Log(level), message, {params: {subject}})
  }

  sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(routes.Event(route), message, {params: {subject}})
  }
}
