import LRUCache = require('lru-cache')

import { createHash } from 'crypto'
import { join, pluck } from 'ramda'
import { AppMetaInfo, Apps } from '../../../../../clients/infra/Apps'
import { IOClients } from '../../../../../clients/IOClients'
import { APP } from '../../../../../constants'
import { appIdToAppAtMajor, parseAppId } from './../../../../../utils/app'
import {
  ParamsContext,
  RecorderState,
  ServiceContext,
} from './../../typings'

const joinIds = join('')

const dependsOnApp = (appAtMajor: string) => (a: AppMetaInfo) => {
  const [name, major] = appAtMajor.split('@')
  const majorInt = major.includes('.') ? major.split('.')[0] : major
  const version = a._resolvedDependencies[name]
  if (!version) {
    return false
  }

  const [depMajor] = version.split('.')
  return majorInt === depMajor
}

export const getFilteredDependencies = (appAtMajor: string, dependencies: AppMetaInfo[]): AppMetaInfo[] => {
  const depends = dependsOnApp(appAtMajor)
  return dependencies.filter(depends)
}

export const getDependenciesHash = (dependencies: AppMetaInfo[]): string => {
  const dependingApps = pluck('id', dependencies)
  return createHash('md5').update(joinIds(dependingApps)).digest('hex')
}

const appJsonCache = new LRUCache<string, any>({max: 10000})
// metrics.trackCache('apps-json', appJsonCache)

async function getJSONWithCrossAccountCache(client: Apps, appId: string, file: string, nullIfNotFound?: boolean) {
  const locator = parseAppId(appId)
  const linked = !!locator.build
  // Let Apps client memory cache handle links since they actually might vary.
  if (linked) {
    return client.getAppJSON(appId, file, nullIfNotFound)
  }

  const key = `${appId}/${file}`
  const cached = appJsonCache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const fetched = await client.getAppJSON(appId, file, nullIfNotFound)
  appJsonCache.set(key, fetched)
  return fetched
}

async function getBuildJSONForApp(apps: Apps, app: AppMetaInfo, appVendorName: string): Promise<Record<string, any>> {
  const buildJson = await getJSONWithCrossAccountCache(apps, app.id, `dist/${appVendorName}/build.json`)
  const result = buildJson

  result.declarer = app.id
  return result
}

export const getDependenciesSettings = async (apps: Apps) => {
  const appId = APP.ID
  const appAtMajor = appIdToAppAtMajor(appId)
  const metaInfos = await apps.getAppsMetaInfos()
  const dependencies = getFilteredDependencies(
    appAtMajor,
    metaInfos
  )

  const [appVendorName] = appAtMajor.split('@')

  return await Promise.all(dependencies.map((dep =>
    getBuildJSONForApp(apps, dep, appVendorName)
  )))
}

export const getServiceSettings = () => {
  return async function settingsContext<
    T extends IOClients,
    U extends RecorderState,
    V extends ParamsContext
  >(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
    const { clients: { apps } } = ctx

    const dependenciesSettings = await getDependenciesSettings(apps)

    // TODO: for now returning all settings, but the ideia is to do merge
    ctx.vtex.settings = dependenciesSettings
    await next()
  }
}
