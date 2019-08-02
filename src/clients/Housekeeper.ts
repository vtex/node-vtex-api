import { InfraClient, InstanceOptions } from '../HttpClient'
import { HousekeeperStatesAndUpdates } from '../responses'
import { IOContext } from '../service/typings'

const createRoutes = () => {
  const routes = {
    Apply: () => `v2/housekeeping/apply`,
    Perform: () => `v2/_housekeeping/perform`,
    Resolve: () => `v2/housekeeping/resolve`,
  }
  return routes
}

export class Housekeeper extends InfraClient {
  private _routes: ReturnType<typeof createRoutes>

  private get routes() {
    return this._routes
  }

  public constructor(context: IOContext, options?: InstanceOptions) {
    super('housekeeper', context, options)
    this._routes = createRoutes()
  }

  public apply = async (data: HousekeeperStatesAndUpdates) =>
    this.http.post(this.routes.Apply(), data, { metric: 'housekeeper-apply' })

  public perform = async () =>
    this.http.post(this.routes.Perform(), {}, { metric: 'housekeeper-perform' })

  public resolve = async (): Promise<HousekeeperStatesAndUpdates> =>
    this.http.get(this.routes.Resolve(), { metric: 'housekeeper-resolve' })
}
