import { createHash } from 'crypto'
import { join, pluck } from 'ramda'

import { AppMetaInfo, Apps } from '../../../../../clients/infra/Apps'
import { IOClients } from '../../../../../clients/IOClients'
import { APP } from '../../../../../constants'
import { Assets } from './../../../../../clients/infra/Assets'
import { appIdToAppAtMajor } from './../../../../../utils/app'
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

export const getFilteredDependencies = (
  appAtMajor: string,
  dependencies: AppMetaInfo[]
): AppMetaInfo[] => {
  const depends = dependsOnApp(appAtMajor)
  return dependencies.filter(depends)
}

export const getDependenciesHash = (dependencies: AppMetaInfo[]): string => {
  const dependingApps = pluck('id', dependencies)
  return createHash('md5')
    .update(joinIds(dependingApps))
    .digest('hex')
}

const formatDependencies = (results: Array<Record<string, any> | undefined>) => {
  return results.reduce((acc: any, curr: any) => {
    if (!curr) { return }
    const configuratorName: string | undefined = curr.declarer
    if (!configuratorName) { return acc }
    const [configurationKey] = configuratorName.split('@')
    const configuration: any = curr[configurationKey]

    if (!configuratorName || !configuration) { return acc }
    acc[configuratorName] = configuration
    return acc
  }, {} as any)
}

export const getDependenciesSettings = async (apps: Apps, assets: Assets) => {
  const appId = APP.ID
  const metaInfos = await apps.getAppsMetaInfos()
  const appAtMajor = appIdToAppAtMajor(appId)

  const allResults = await assets.getSettings(metaInfos, appAtMajor)

  return formatDependencies(allResults)
}

export const getServiceSettings = () => {
  return async function settingsContext<
    T extends IOClients,
    U extends RecorderState,
    V extends ParamsContext
  >(ctx: ServiceContext<T, U, V>, next: () => Promise<void>) {
    const {
      clients: { apps, assets },
    } = ctx

    const dependenciesSettings = await getDependenciesSettings(apps, assets)

    // TODO: for now returning all settings, but the ideia is to do merge
    ctx.vtex.settings = dependenciesSettings
    await next()
  }
}
