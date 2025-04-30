import { parse as qsParse } from 'querystring'

import { IOClients } from '../../../../../clients/IOClients'
import { HeaderKeys } from '../../../../../constants'
import { prepareHandlerCtx } from '../../utils/context'
import {
  ParamsContext,
  RecorderState,
  ServiceContext,
  ServiceRoute,
} from './../../typings'

export const createPvtContextMiddleware = (
  routeId: string,
  { smartcache }: ServiceRoute
) => {
  return async function pvtContext<
    T extends IOClients,
    U extends RecorderState,
    V extends ParamsContext
  >(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
    const {
      params,
      request: { header },
    } = ctx
    ctx.vtex = {
      ...prepareHandlerCtx(header, ctx.tracing),
      ...(smartcache && { recorder: ctx.state.recorder }),
      route: {
        id: routeId,
        params,
        type: 'private',
      },
    }
    await next()
  }
}

export const createPubContextMiddleware = (
  routeId: string,
  { smartcache }: ServiceRoute
) => {
  return async function pubContext<
    T extends IOClients,
    U extends RecorderState,
    V extends ParamsContext
  >(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
    const {
      request: { header },
    } = ctx

    ctx.vtex = {
      ...prepareHandlerCtx(header, ctx.tracing),
      ...(smartcache && { recorder: ctx.state.recorder }),
      route: {
        declarer: header[HeaderKeys.COLOSSUS_ROUTE_DECLARER],
        id: routeId,
        params: qsParse(header[HeaderKeys.COLOSSUS_PARAMS]),
        type: 'public',
      },
    }
    await next()
  }
}
