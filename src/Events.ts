import {HttpClient, InstanceOptions, IOContext, withoutRecorder} from './HttpClient'
import {HttpClientFactory, IODataSource} from './utils/dataSource'

const eventRoute = (route: string) => `/events/${route}`

const forWorkspaceWithoutRecorder: HttpClientFactory = ({service, context, options}) => (service && context)
  ? HttpClient.forWorkspace(service, withoutRecorder(context), options || {})
  : undefined

export class Events extends IODataSource {
  constructor (context: IOContext, options: InstanceOptions = {}) {
    super(forWorkspaceWithoutRecorder, {
      context,
      options,
      service: 'colossus',
    })
  }

  public sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(eventRoute(route), message, {params: {subject}})
  }
}
