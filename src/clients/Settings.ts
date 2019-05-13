import { createHash } from 'crypto'
import { filter, join, pluck } from 'ramda'

import { AppClient, inflightUrlWithQuery, InstanceOptions } from '../HttpClient'
import { IOContext } from '../service/typings'

import { AppMetaInfo, Apps } from './Apps'

const dependsOnApp = (appAtMajor: string) => (a: AppMetaInfo) => {
  const [name, major] = appAtMajor.split('@')
  const version = a._resolvedDependencies[name]
  if (!version) {
    return false
  }

  const [depMajor] = version.split('.')
  return major === depMajor
}

const joinIds = join('')

export interface SettingsParams {
  merge?: boolean
  files?: string[]
}

export class Settings extends AppClient {
  constructor (context: IOContext, options?: InstanceOptions) {
    super('vtex.settings-server', context, options)
  }

  public getFilteredDependencies(appAtMajor: string, dependencies: AppMetaInfo[]): AppMetaInfo[] {
    const depends = dependsOnApp(appAtMajor)
    return filter(depends, dependencies)
  }

  public getDependenciesHash(dependencies: AppMetaInfo[]): string {
    const dependingApps = pluck('id', dependencies)
    return createHash('md5').update(joinIds(dependingApps)).digest('hex')
  }

  public async getSettings(dependencies: AppMetaInfo[], appAtMajor: string, params?: SettingsParams) {
    const filtered = this.getFilteredDependencies(appAtMajor, dependencies)
    const depsHash = this.getDependenciesHash(filtered)
    return this.http.get(`/settings/${appAtMajor}/${depsHash}`, {
      inflightKey: inflightUrlWithQuery,
      metric: 'settings-get',
      params,
    })
  }
}
