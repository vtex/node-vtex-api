import { contains } from 'ramda';
import { parse as qsParse } from 'querystring'
import { appIdToAppAtMajor } from './../../../../../utils/app'

import { IOClients } from '../../../../../clients/IOClients'
import {
  APP,
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
      ...prepareHandlerCtx(header),
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
      ...prepareHandlerCtx(header),
      ...(smartcache && { recorder: ctx.state.recorder }),
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

export const maybeGetServiceConfigurations = () => {
  return async function configurationContext<
    T extends IOClients,
    U extends RecorderState,
    V extends ParamsContext
  >(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
    const appId = APP.ID
    const appAtMajor = appIdToAppAtMajor(appId)
    // TODO: find where the dependency tree is and use it, instead of calling APPS
    const metaInfos = await ctx.clients.apps.getAppsMetaInfos()
    const dependencies = ctx.clients.settings.getFilteredDependencies(
      appAtMajor,
      metaInfos
    )
    const dps = (metaInfos as any[]).filter(i => (i.id as string).includes('app-test'))[0]
    const version = dps._resolvedDependencies['vtex.service-example']
    const [meta] = version.split('.')
    const [_, major] = appAtMajor.split('@')
    ctx.vtex.configurations = {
      configuration: 'a',
      deps: JSON.stringify(dependencies),
      major,
      meta,
      test: appAtMajor,
    }
    await next()
  }
}
