import { parse as qsParse } from 'querystring'

import { IOClients } from '../../../../../clients/IOClients'
import {
  COLOSSUS_PARAMS_HEADER,
  COLOSSUS_ROUTE_DECLARER_HEADER,
} from '../../../../../constants'
import { prepareHandlerCtx } from '../../utils/context'
import {
  ParamsContext,
  RecorderState,
  ServiceContext,
  ServiceRoute,
} from './../../typings'

export const createPvtContextMiddleware = (routeId: string, { smartcache }: ServiceRoute) => {
  return async function pvtContext <T extends IOClients, U extends RecorderState, V extends ParamsContext>(ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
    const { params, request: { header } } = ctx
    ctx.vtex = {
      ...prepareHandlerCtx(header),
      ...smartcache && { recorder: ctx.state.recorder },
      route: {
        id: routeId,
        params,
        type: 'private',
      },
    }
    await next()
  }
}

export const createPubContextMiddleware = (routeId: string, { smartcache }: ServiceRoute) => {
  return async function pubContext <T extends IOClients, U extends RecorderState, V extends ParamsContext>(ctx: ServiceContext<T, U, V>, next: () => Promise<any>) {
    const { request: { header } } = ctx
    ctx.vtex = {
      ...prepareHandlerCtx(header),
      ...smartcache && {recorder: ctx.state.recorder},
      route: {
        declarer: header[COLOSSUS_ROUTE_DECLARER_HEADER],
        id: routeId,
        params: qsParse(header[COLOSSUS_PARAMS_HEADER]),
        type: 'public',
      },
    }
    await next()
  }
}
