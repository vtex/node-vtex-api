import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

const eventRoute = (route: string) => `/events/${route}`

export class Events extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('courier@0.x', { ...context, recorder: undefined }, options)
  }

  public sendEvent = (subject: string, route: string, message?: any, tracingConfig?: RequestTracingConfig) => {
    const resource =
      subject === ''
        ? ''
        : `vrn:apps:aws-us-east-1:${this.context.account}:${this.context.workspace}:/apps/${subject}`
    return this.http.put(eventRoute(route), message, {
      metric: 'events-send',
      params: { resource },
      tracing: {
        requestSpanNameSuffix: 'events-send',
        ...tracingConfig?.tracing,
      },
    })
  }
}
