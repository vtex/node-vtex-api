import { any } from 'ramda'

import { inflightUrlWithQuery, InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { getDependenciesHash, getFilteredDependencies } from '../../service/worker/runtime/http/middlewares/settings'
import { IOContext } from '../../service/worker/runtime/typings'
import { isLinkedApp } from '../../utils/app'
import { AppMetaInfo } from '../infra/Apps'
import { AppClient } from './AppClient'

const LINKED_ROUTE = 'linked'

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
    return getFilteredDependencies(appAtMajor, dependencies)
  }

  public getDependenciesHash(dependencies: AppMetaInfo[]): string {
    return getDependenciesHash(dependencies)
  }

  public async getSettings(dependencies: AppMetaInfo[], appAtMajor: string, params?: SettingsParams, tracingConfig?: RequestTracingConfig) {
    const filtered = this.getFilteredDependencies(appAtMajor, dependencies)
    // Settings server exposes a smartCache-enabled route for when the workspace contains links.
    const lastSegment = containsLinks(filtered)
      ? LINKED_ROUTE
      : this.getDependenciesHash(filtered)

    const metric = 'settings-get'
    return this.http.get(`/settings/${appAtMajor}/${lastSegment}`, {
      inflightKey: inflightUrlWithQuery,
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }
}
