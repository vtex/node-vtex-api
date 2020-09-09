import { isNullOrUndefined, isObject } from 'util'
import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

const ANY_APP = ''
const eventRoute = (route: string) => `/events/${route}`
const isResourceVRN = (appIdOrResource: string | ResourceVRN): appIdOrResource is ResourceVRN =>
  isObject(appIdOrResource) && !isNullOrUndefined((appIdOrResource as ResourceVRN).service)

export class Events extends InfraClient {
  constructor({ recorder, ...context }: IOContext, options?: InstanceOptions) {
    super('courier@0.x', context, options)
  }

  public sendEvent = (
    appIdOrResource: string | ResourceVRN,
    route: string,
    message?: any,
    tracingConfig?: RequestTracingConfig
  ) => {
    const resource = this.resourceFor(appIdOrResource)
    return this.http.put(eventRoute(route), message, {
      metric: 'events-send',
      params: { resource },
      tracing: {
        requestSpanNameSuffix: 'events-send',
        ...tracingConfig?.tracing,
      },
    })
  }

  private resourceFor = (appIdOrResource: string | ResourceVRN) => {
    if (appIdOrResource === ANY_APP) {
      return ANY_APP
    }
    const { service, path } = isResourceVRN(appIdOrResource)
      ? appIdOrResource
      : { service: 'apps', path: `/apps/${appIdOrResource}` }
    return `vrn:${service}:${this.context.region}:${this.context.account}:${this.context.workspace}:${path}`
  }
}

export interface ResourceVRN {
  service: string
  path: string
}
