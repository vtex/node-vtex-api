import { InfraClient, InstanceOptions} from '../HttpClient'
import { IOContext } from '../service/typings'

const eventRoute = (route: string) => `/events/${route}`

export class Events extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('colossus@0.x', {...context, recorder: undefined}, options)
  }

  public sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(eventRoute(route), message, {params: {subject}, metric: 'events-send'})
  }
}