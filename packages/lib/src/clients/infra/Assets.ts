import { contains, filter, isEmpty, pick as ramdaPick, zipObj } from 'ramda'
import { Readable } from 'stream'

import { AppMetaInfo } from '../..'
import { CacheType, inflightURL, InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import {
  IgnoreNotFoundRequestConfig,
} from '../../HttpClient/middlewares/notFound'
import { IOContext } from '../../service/worker/runtime/typings'
import { parseAppId, ParsedLocator } from '../../utils'
import { InfraClient } from './InfraClient'

const dependsOnApp = (appsAtMajor: string[]) => (a: AppMetaInfo) => {
  let dependsOn = false
  appsAtMajor.forEach(appAtMajor => {
    const [name, major] = appAtMajor.split('@')
    const sanitizedMajor = major.includes('.') ? major.split('.')[0] : major
    const version = a._resolvedDependencies[name]
    if (version) {
      const [depMajor] = version.split('.')
      if (sanitizedMajor === depMajor) {
        dependsOn = true
      }
    }
  })
  return dependsOn
}

const useBuildJson = (app: AppMetaInfo, appVendorName: string) => {
  const buildFeatures = app._buildFeatures
  return buildFeatures && buildFeatures[appVendorName] && contains('build.json', buildFeatures[appVendorName])
}

export interface AssetsParams {
  files?: string[]
  pick?: string[]
}

const appOrRegistry = (workspace: string, { name, version, build }: ParsedLocator) =>
    build
      ? `${workspace}/apps/${name}@${version}+${build}`
      : `master/registry/${name}/${version}`

const createRoutes = (workspace: string) => ({
  Bundle: (scope: string, locator: ParsedLocator, path: string) => `/${scope}/${appOrRegistry(workspace, locator)}/bundle/${path}`,
  Files: (scope: string, locator: ParsedLocator, path: string) => `/${scope}/${appOrRegistry(workspace, locator)}/files/${path}`,
})

export class Assets extends InfraClient {
  private routes: ReturnType<typeof createRoutes>

  constructor(context: IOContext, options?: InstanceOptions) {
    super('apps@0.x', context, options, true)
    this.routes = createRoutes(this.context.workspace)
  }

  public getSettings (dependencies: AppMetaInfo[], appAtMajor: string, params: AssetsParams = {}, tracingConfig?: RequestTracingConfig) {
    const {pick, files} = params
    const filtered = this.getFilteredDependencies(appAtMajor, dependencies)

    return Promise.all(filtered.map(dependency => {
      const [appVendorName] = appAtMajor.split('@')
      const buildJson = useBuildJson(dependency, appVendorName)

      return buildJson
        ? this.getBuildJSONForApp(dependency, appVendorName, pick, tracingConfig)
        : this.getSettingsFromFilesForApp(dependency, files, tracingConfig)
    }
    ))
  }

  public async getBuildJSONForApp(app: AppMetaInfo, appVendorName: string, pick: string | string[] = [], tracingConfig?: RequestTracingConfig): Promise<Record<string, any>> {
    const pickArray = Array.isArray(pick) ? pick : [pick]
    const buildJson: Record<string, any> = await this.getJSON(app.id, `dist/${appVendorName}/build.json`, undefined, tracingConfig)
    const result = !isEmpty(pickArray) ? ramdaPick(pickArray, buildJson) : buildJson

    result.declarer = app.id
    return result
  }

  public async getSettingsFromFilesForApp(app: AppMetaInfo, files: string | string[] = [], tracingConfig?: RequestTracingConfig): Promise<Record<string, any>> {
    // If there's no support for build.json, then fetch individual files and zip them into an {[file]: content} object.
    const filesArray = Array.isArray(files) ? files : [files]
    const fetched = await Promise.all(filesArray.map(file => this.getJSON(app.id, file, true, tracingConfig)))
    const result: Record<string, any> = zipObj(filesArray, fetched)

    result.declarer = app.id
    return result
  }

  public async getJSON<T extends object | null>(appId: string, file: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) {
    const locator = parseAppId(appId)
    const linked = !!locator.build

    if (linked) {
      return this.getAppJSONByAccount<T>(appId, file, nullIfNotFound, tracingConfig)
    }
    return this.getAppJSONByVendor<T>(appId, file, nullIfNotFound, tracingConfig)
  }

  public async getFile(appId: string, file: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) {
    const locator = parseAppId(appId)
    const linked = !!locator.build

    if (linked) {
      return this.getAppFileByAccount(appId, file, nullIfNotFound, tracingConfig)
    }
    return this.getAppFileByVendor(appId, file, nullIfNotFound, tracingConfig)
  }

  public getFilteredDependencies(apps: string | string[], dependencies: AppMetaInfo[]): AppMetaInfo[] {
    const appsAtMajor: string[] = typeof(apps) === 'string' ? [apps] : apps
    const depends = dependsOnApp(appsAtMajor)
    return filter(depends, dependencies)
  }

  public getAppBundleByVendor = (app: string, bundlePath: string, generatePackageJson: boolean, tracingConfig?: RequestTracingConfig): Promise<Readable> => {
    const locator = parseAppId(app)
    const params = generatePackageJson && {_packageJSONEngine: 'npm', _packageJSONFilter: 'vtex.render-builder@x'}
    const metric = locator.build ? 'apps-get-bundle' : 'registry-get-bundle'
    return this.http.getStream(this.routes.Bundle(this.context.account, locator, bundlePath), {
      headers: {
        Accept: 'application/x-gzip',
        'Accept-Encoding': 'gzip',
      },
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  protected getAppJSONByAccount = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) => {
    const locator = parseAppId(app)
    const inflightKey = inflightURL
    const metric = 'assets-get-json-by-account'
    return this.http.get<T>(this.routes.Files(this.context.account, locator, path), {
      cacheable: CacheType.Memory,
      inflightKey,
      metric,
      nullIfNotFound,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    } as IgnoreNotFoundRequestConfig)
  }

  protected getAppJSONByVendor = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) => {
    const locator = parseAppId(app)
    const vendor = locator.name.split('.')[0]
    const inflightKey = inflightURL
    const metric = 'assets-get-json-by-vendor'
    return this.http.get<T>(this.routes.Files(vendor, locator, path), {
        cacheable: CacheType.Any,
        inflightKey,
        metric,
        nullIfNotFound,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      } as IgnoreNotFoundRequestConfig)
  }

  protected getAppFileByAccount = (app: string, path: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) => {
    const locator = parseAppId(app)
    const inflightKey = inflightURL
    const metric = 'assets-get-file-by-account'
    return this.http.getBuffer(this.routes.Files(this.context.account, locator, path), {
      cacheable: CacheType.Any,
      inflightKey,
      metric,
      nullIfNotFound,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  protected getAppFileByVendor = (app: string, path: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) => {
    const locator = parseAppId(app)
    const vendor = locator.name.split('.')[0]
    const inflightKey = inflightURL
    const metric = 'assets-get-file-by-vendor'
    return this.http.getBuffer(this.routes.Files(vendor, locator, path), {
      cacheable: CacheType.Any,
      inflightKey,
      metric,
      nullIfNotFound,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }
}


