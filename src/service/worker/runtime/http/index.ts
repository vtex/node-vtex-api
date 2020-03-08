import { IOClients } from '../../../../clients/IOClients'
import { insertUserLandTracer, nameSpanOperationMiddleware, traceUserLandRemainingPipelineMiddleware } from '../../../tracing/tracingMiddlewares'
import {
  ClientsConfig,
  ParamsContext,
  RecorderState,
  RouteHandler,
  ServiceRoute,
} from '../typings'
import { compose } from '../utils/compose'
import { toArray } from '../utils/toArray'
import { authTokens } from './middlewares/authTokens'
import { cancellationToken } from './middlewares/cancellationToken'
import { cdnNormalizer } from './middlewares/cdnNormalizer'
import { clients } from './middlewares/clients'
import {
  createPubContextMiddleware,
  createPvtContextMiddleware,
} from './middlewares/context'
import { error } from './middlewares/error'
import { trackIncomingRequestStats } from './middlewares/requestStats'
import { removeSetCookie } from './middlewares/setCookie'
import { getServiceSettings } from './middlewares/settings'
import { timings } from './middlewares/timings'
import { vary } from './middlewares/vary'

export const createPrivateHttpRoute = <T extends IOClients, U extends RecorderState, V extends ParamsContext>(
  clientsConfig: ClientsConfig<T>,
  serviceHandler: RouteHandler<T, U, V> | Array<RouteHandler<T, U, V>>,
  serviceRoute: ServiceRoute,
  routeId: string
) => {
  const { implementation, options } = clientsConfig
  const middlewares = toArray(serviceHandler)
  const pipeline = [
    nameSpanOperationMiddleware('private-handler', routeId),
    createPvtContextMiddleware(routeId, serviceRoute),
    cancellationToken,
    trackIncomingRequestStats,
    vary,
    authTokens,
    insertUserLandTracer,
    clients(implementation!, options),
    ...(serviceRoute.settingsType === 'workspace' || serviceRoute.settingsType === 'userAndWorkspace' ? [getServiceSettings()] : []),
    timings,
    error,
    traceUserLandRemainingPipelineMiddleware(`user-private-handler:${routeId}`),
    ...middlewares,
  ]
  return compose(pipeline)
}

export const createPublicHttpRoute = <T extends IOClients, U extends RecorderState, V extends ParamsContext>(
  clientsConfig: ClientsConfig<T>,
  serviceHandler: RouteHandler<T, U, V> | Array<RouteHandler<T, U, V>>,
  serviceRoute: ServiceRoute,
  routeId: string
) => {
  const { implementation, options } = clientsConfig
  const middlewares = toArray(serviceHandler)
  const pipeline = [
    nameSpanOperationMiddleware('public-handler', routeId),
    createPubContextMiddleware(routeId, serviceRoute),
    cancellationToken,
    trackIncomingRequestStats,
    cdnNormalizer,
    vary,
    authTokens,
    insertUserLandTracer,
    clients(implementation!, options),
    ...(serviceRoute.settingsType === 'workspace' || serviceRoute.settingsType === 'userAndWorkspace' ? [getServiceSettings()] : []),
    removeSetCookie,
    timings,
    error,
    traceUserLandRemainingPipelineMiddleware(`user-public-handler:${routeId}`),
    ...middlewares,
  ]
  return compose(pipeline)
}
