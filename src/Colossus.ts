import {HttpClient, InstanceOptions} from './HttpClient'

const getSubjectToRequest = (subject: string) => {
  return subject.length > 0 ? `&subject=${subject}` : ""
}

const routes = {
  Event: (subject: string, route: string) => `/events/${route}${getSubjectToRequest(subject)}`,
  Log: (subject: string, level: string) => `/logs/${level}${getSubjectToRequest(subject)}`,
}

export class Colossus {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('colossus', opts)
  }

  sendLog = (subject: string, message: any, level: string) => {
    return this.http.put(routes.Log(subject, level), message)
  }

  sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(routes.Event(subject, route), message)
  }
}
