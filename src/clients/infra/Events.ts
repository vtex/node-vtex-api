import { InstanceOptions } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

const eventRoute = (route: string) => `/events/${route}`

export class Events extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('colossus@0.x', {...context, recorder: undefined}, options)
  }

  public sendEvent = (subject: string, route: string, message?: any) => {
    return this.http.put(eventRoute(route), message, {params: {subject}, metric: 'events-send'})
  }
}
