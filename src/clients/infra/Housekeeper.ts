import { InstanceOptions } from '../../HttpClient'
import { HousekeeperStatesAndUpdates } from '../../responses'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

export class Housekeeper extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('housekeeper@0.x', context, options)
  }

  public apply = async (data: HousekeeperStatesAndUpdates) =>
    this.http.post('v2/housekeeping/apply', data, { metric: 'housekeeper-apply' })

  public perform = async () =>
    this.http.post('v2/_housekeeping/perform', {}, { metric: 'housekeeper-perform' })

  public resolve = async (): Promise<HousekeeperStatesAndUpdates> =>
    this.http.get('v2/housekeeping/resolve', { metric: 'housekeeper-resolve' })
}
