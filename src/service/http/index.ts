import { ClientsImplementation, IOClients } from '../../clients/IOClients'
import { InstanceOptions } from '../../HttpClient'
import { RouteHandler } from '../typings'
import { compose } from '../utils/compose'
import { authTokens } from './middlewares/authTokens'
import { cdnNormalizer } from './middlewares/cdnNormalizer'
import { clients } from './middlewares/clients'
import { error } from './middlewares/error'
import { logger } from './middlewares/logger'
import { trackIncomingRequestStats } from './middlewares/requestStats'
import { removeSetCookie } from './middlewares/setCookie'
import { timings } from './middlewares/timings'
import { vary } from './middlewares/vary'

export const createHttpRoute = <ClientsT extends IOClients, StateT, CustomT>(
  Clients: ClientsImplementation<ClientsT>,
  options: Record<string, InstanceOptions>
) => {
  return (handler: RouteHandler<ClientsT, StateT, CustomT> | Array<RouteHandler<ClientsT, StateT, CustomT>>) => {
    const middlewares = Array.isArray(handler) ? handler : [handler]
    const pipeline = [trackIncomingRequestStats, cdnNormalizer, vary, authTokens, logger, clients(Clients, options), removeSetCookie, timings, error, ...middlewares]
    return compose(pipeline)
  }
}
