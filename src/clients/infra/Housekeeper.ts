import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { HousekeeperStatesAndUpdates } from '../../responses'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

export class Housekeeper extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('housekeeper@0.x', context, options)
  }

  public apply = async (data: HousekeeperStatesAndUpdates, tracingConfig?: RequestTracingConfig) =>{
    const metric = 'housekeeper-apply'
    return this.http.post('v2/housekeeping/apply', data, { metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public perform = async (tracingConfig?: RequestTracingConfig) => {
    const metric = 'housekeeper-perform'
    return this.http.post('v2/_housekeeping/perform', {}, { metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public resolve = async (tracingConfig?: RequestTracingConfig): Promise<HousekeeperStatesAndUpdates> => {
    const metric = 'housekeeper-resolve'
    return this.http.get('v2/housekeeping/resolve', { metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }
}
