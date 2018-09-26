import {HttpClient, InstanceOptions, IOContext, withoutRecorder} from './HttpClient'

const eventRoute = (route: string) => `/events/${route}`

export class Event {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forWorkspace('colossus', withoutRecorder(ioContext), opts)
  }

  public sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(eventRoute(route), message, {params: {subject}})
  }
}