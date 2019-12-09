import { createHash } from 'crypto'
import { any, filter, join, pluck } from 'ramda'

import { inflightUrlWithQuery, InstanceOptions } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { isLinkedApp } from '../../utils/app'
import { AppMetaInfo } from '../infra/Apps'
import { AppClient } from './AppClient'

const LINKED_ROUTE = 'linked'

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
const containsLinks = any(isLinkedApp)

export interface SettingsParams {
  merge?: boolean
  files?: string[]
}

export class Settings extends AppClient {
  constructor (context: IOContext, options?: InstanceOptions) {
    super('vtex.settings-server@0.x', context, options)
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
    // Settings server exposes a smartCache-enabled route for when the workspace contains links.
    const lastSegment = containsLinks(filtered)
      ? LINKED_ROUTE
      : this.getDependenciesHash(filtered)

    return this.http.get(`/settings/${appAtMajor}/${lastSegment}`, {
      inflightKey: inflightUrlWithQuery,
      metric: 'settings-get',
      params,
    })
  }
}
