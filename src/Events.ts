import {InstanceOptions, IOContext, withoutRecorder} from './HttpClient'
import {IODataSource, workspaceClientFactory} from './utils/dataSource'

const eventRoute = (route: string) => `/events/${route}`

export class Events extends IODataSource {
  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    super(workspaceClientFactory, {
      context: withoutRecorder(ioContext),
      options,
      service: 'colossus',
    })
  }

  public sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(eventRoute(route), message, {params: {subject}})
  }
}
