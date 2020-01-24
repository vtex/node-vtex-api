import { createHash } from 'crypto'
import { join } from 'path'
import { pluck } from 'ramda'

import { AppMetaInfo } from '../../../../../clients/infra/Apps'

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

export const getServiceSettings = async () => {
  try {
    const middlewarePath = join(process.cwd(), './service/node_modules/@vtex/settings-middleware')
    const lib = await import(middlewarePath)
    return lib.SettingsMiddleware()
  } catch (e) {
    console.log('ERROR IMPORTING @vtex/settings-middleware', e)
    return undefined
  }
}
