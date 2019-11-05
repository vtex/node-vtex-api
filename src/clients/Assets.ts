import { contains, filter, isEmpty, pick as ramdaPick, zipObj } from 'ramda'

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

  public getSettings (dependencies: AppMetaInfo[], appAtMajor: string, params: AssetsParams = {}) {
    const filtered = this.getFilteredDependencies(appAtMajor, dependencies)
    const {pick, files} = params

    return Promise.all(filtered.map(dependency => {
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
    const buildJson = await this.getFile(app.id, `dist/${appVendorName}/build.json`) as Record<string, any>
    const result = !isEmpty(pickArray) ? ramdaPick(pickArray, buildJson) : buildJson

    result.declarer = app.id
    return result
  }

  public async getSettingsFromFilesForApp(app: AppMetaInfo, files: string | string[] = []): Promise<Record<string, any>> {
    // If there's no support for build.json, then fetch individual files and zip them into an {[file]: content} object.
    const filesArray = Array.isArray(files) ? files : [files]
    const fetched = await Promise.all(filesArray.map(file => this.getFile(app.id, file, true)))
    const result: Record<string, any> = zipObj(filesArray, fetched)

    result.declarer = app.id
    return result
  }

  public async getFile(appId: string, file: string, nullIfNotFound?: boolean) {
    const locator = parseAppId(appId)
    const linked = !!locator.build

    if (linked) {
      return this.getAppFileByAccount(appId, file, nullIfNotFound)
    }
    return this.getAppFileByVendor(appId, file, nullIfNotFound)
  }

  public getFilteredDependencies(appAtMajor: string, dependencies: AppMetaInfo[]): AppMetaInfo[] {
    const depends = dependsOnApp(appAtMajor)
    return filter(depends, dependencies)
  }

  protected getAppFileByAccount = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean) => {
    const locator = parseAppId(app)
    const inflightKey = inflightURL
    return this.http.get<T>(this.route(this.context.account, locator, path), {
      cacheable: CacheType.Memory,
      inflightKey,
      metric: 'assets-get-json-by-account',
      nullIfNotFound,
    } as IgnoreNotFoundRequestConfig)
  }

  protected getAppFileByVendor = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean) => {
    const locator = parseAppId(app)
    const vendor = locator.name.split('.')[0]
    const inflightKey = inflightURL
    return this.http.get<T>(this.route(vendor, locator, path), {
        cacheable: CacheType.Any,
        inflightKey,
        metric: 'assets-get-json-by-vendor',
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


