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
        configurationDependecy: 'workspace',
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
        configurationDependecy: 'workspace',
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
    console.log('STARTING MAYBE GET SERVICE CONFIGURATIONS', ctx.vtex.route.configurationDependecy)
    if (ctx.vtex.route.configurationDependecy !== 'pure') {
      const appId = APP.ID
      const appAtMajor = appIdToAppAtMajor(appId)
      // TODO: find where the dependency tree is and use it, instead of calling APPS
      const metaInfos = await ctx.clients.apps.getAppsMetaInfos()
      const dependencies = ctx.clients.settings.getFilteredDependencies(
        appAtMajor,
        metaInfos
      )

      if (dependencies[0]) {
        const [appName] = (dependencies[0].id as string).split('@')
        const [serviceName] = appAtMajor.split('@')
        const configuration = await ctx.clients.apps.getFileFromApps(appName, `dist/${serviceName}/${appName}.json`)
        console.log('CONFIG', configuration)
        ctx.vtex.configurations = configuration
      }
    }
    await next()
  }
}
