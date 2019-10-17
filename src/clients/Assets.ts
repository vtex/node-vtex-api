import { contains, filter, isEmpty, map, pick as ramdaPick, zipObj } from 'ramda'

import { AppMetaInfo } from '..'
import { CacheType, inflightURL, InfraClient, InstanceOptions } from '../HttpClient'
import { IgnoreNotFoundRequestConfig } from '../HttpClient/middlewares/notFound'
import { IOContext } from '../service/typings'
import { parseAppId, ParsedLocator } from '../utils'

const dependsOnApp = (appAtMajor: string) => (a: AppMetaInfo) => {
  const [name, major] = appAtMajor.split('@')
  const version = a._resolvedDependencies[name]
  if (!version) {
    return false
  }

  const [depMajor] = version.split('.')
  return major === depMajor
}

const useBuildJson = (app: AppMetaInfo, appVendorName: string) => {
  const buildFeatures = (app as any)._buildFeatures as Record<string, string[]> | undefined
  return buildFeatures && buildFeatures[appVendorName] && contains('build.json', buildFeatures[appVendorName])
}

export interface AssetsParams {
  files?: string[]
  pick?: string[]
}

export class Assets extends InfraClient {
  private route: (scope: string, locator: ParsedLocator, path: string) => string

  constructor(context: IOContext, options?: InstanceOptions) {
    super('apps', context, options, true)
    this.route = this.fileRoute(this.context.workspace)
  }

  public async getSettings (dependencies: AppMetaInfo[], appAtMajor: string, params: AssetsParams = {}) {
    const filtered = this.getFilteredDependencies(appAtMajor, dependencies)
    const {pick, files} = params

    return await Promise.all(filtered.map(dependency => {
      const [appVendorName] = appAtMajor.split('@')
      const buildJson = useBuildJson(dependency, appVendorName)

      return buildJson
        ? this.getBuildJSONForApp(dependency, appVendorName, pick)
        : this.getSettingsFromFilesForApp(dependency, files)
    }
    ))
  }

  public async getBuildJSONForApp(app: AppMetaInfo, appVendorName: string, pick: string | string[] = []): Promise<Record<string, any>> {
    const pickArray = Array.isArray(pick) ? pick : [pick]
    const buildJson = await this.getJSON(app.id, `/dist/${appVendorName}/build.json`) as Record<string, any>
    const result = !isEmpty(pickArray) ? ramdaPick(pickArray, buildJson) : buildJson

    result.declarer = app.id
    return result
  }

  public async getSettingsFromFilesForApp(app: AppMetaInfo, files: string | string[] = []): Promise<Record<string, any>> {
    // If there's no support for build.json, then fetch individual files and zip them into an {[file]: content} object.
    const filesArray = Array.isArray(files) ? files : [files]
    const fetched = await Promise.all(map((file) => this.getJSON(app.id, file, true), filesArray as string[]))
    const result = zipObj(filesArray as string[], fetched) as Record<string, any>

    result.declarer = app.id
    return result
  }

  public async getJSON(appId: string, file: string, nullIfNotFound?: boolean) {
    const locator = parseAppId(appId)
    const linked = !!locator.build

    if (linked) {
      return this.getAppJSON(appId, file, nullIfNotFound)
    }
    return this.getAppJSONByVendor(appId, file, nullIfNotFound)
  }

  public getFilteredDependencies(appAtMajor: string, dependencies: AppMetaInfo[]): AppMetaInfo[] {
    const depends = dependsOnApp(appAtMajor)
    return filter(depends, dependencies)
  }

  public getAppJSON = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean) => {
    const locator = parseAppId(app)
    const linked = !!locator.build
    const inflightKey = inflightURL
    return this.http.get<T>(this.route(this.context.account, locator, path), {
      cacheable: linked ? CacheType.Memory : CacheType.Any,
      inflightKey,
      metric: linked ? 'apps-get-assets-json' : 'registry-get-assets-json',
      nullIfNotFound,
    } as IgnoreNotFoundRequestConfig)
  }

  public getAppJSONByVendor = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean) => {
    const locator = parseAppId(app)
    const vendor = locator.name.split('.')[0]
    const linked = !!locator.build
    const inflightKey = inflightURL
    return linked? this.getAppJSON(app, path, nullIfNotFound):
      this.http.get<T>(this.route(vendor, locator, path), {
        cacheable: CacheType.Any,
        inflightKey,
        metric: 'registry-get-assets-json-by-vendor',
        nullIfNotFound,
      } as IgnoreNotFoundRequestConfig)
  }

  private fileRoute(workspace: string) {
    const appOrRegistry = ({ name, version, build }: ParsedLocator) => build
      ? `${workspace}/apps/${name}@${version}+${build}`
      : `master/registry/${name}/${version}`

    return (scope: string, locator: ParsedLocator, path: string) => `/${scope}/${appOrRegistry(locator)}/files/${path}`
  }
}


