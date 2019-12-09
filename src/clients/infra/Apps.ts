import archiver from 'archiver'
import { IncomingMessage } from 'http'
import { filter as ramdaFilter, path as ramdaPath, prop } from 'ramda'
import { Readable, Writable } from 'stream'
import { extract } from 'tar-fs'
import { createGunzip, ZlibOptions } from 'zlib'

import { CacheLayer } from '../..'
import {
  CacheType,
  inflightURL,
  inflightUrlWithQuery,
  InstanceOptions,
} from '../../HttpClient'
import {
  IgnoreNotFoundRequestConfig,
} from '../../HttpClient/middlewares/notFound'
import { AppBundleLinked, AppFilesList, AppManifest } from '../../responses'
import { IOContext } from '../../service/worker/runtime/typings'
import { parseAppId, removeVersionFromAppId } from '../../utils'
import {
  getFallbackFile,
  getMetaInfoKey,
  saveVersion,
  updateMetaInfoCache,
} from '../../utils/appsStaleIfError'
import { InfraClient } from './InfraClient'

const createRoutes = ({account, workspace}: IOContext) => {
  const routes = {
    Acknowledge: (app: string, service: string) => `${routes.App(app)}/acknowledge/${service}`,
    App: (app: string) => `${routes.Apps()}/${app}`,
    AppBundle: (locator: AppLocator, path: string) => `${routes.AppOrRegistry(locator)}/bundle/${path}`,
    AppOrRegistry: ({name, version, build}: AppLocator) => build
      ? `${routes.Apps()}/${name}@${version}+${build}`
      : `${routes.Registry()}/${name}/${version}`,
    Apps: () => `${routes.Workspace}/apps`,
    Dependencies:() => `${routes.Workspace}/dependencies`,
    File: (locator: AppLocator, path: string) => `${routes.Files(locator)}/${path}`,
    Files: (locator: AppLocator) => `${routes.AppOrRegistry(locator)}/files`,
    Link: (app: string) => `${routes.Workspace}/v2/links/${app}`,
    Links: () => `${routes.Workspace}/links`,
    Master: `/${account}/master`,
    Meta: () => `${routes.Workspace}/v2/apps`,
    Registry: () => `${routes.Master}/registry`,
    ResolveDependencies: () => `${routes.Workspace}/dependencies/_resolve`,
    ResolveDependenciesWithManifest: () => `${routes.Workspace}/v2/apps/_resolve`,
    Settings: (app: string) => `${routes.App(app)}/settings`,
    Unlink: (app: string) => `${routes.Links()}/${app}`,
    Workspace: `/${account}/${workspace}`,
  }
  return routes
}

const getVendorAndName = ({id}: {id: string}) => removeVersionFromAppId(id)
const notFound = (e: any) => {
  if (e.response && e.response.status === 404) {
    return {}
  }
  throw e
}

const zipObj = (keys: string[], values: any[]) => {
  let idx = 0
  const len = Math.min(keys.length, values.length)
  const out: {[key: string]: any} = {}
  while (idx < len) {
    out[keys[idx]] = values[idx]
    idx += 1
  }
  return out
}

const workspaceFields = [
  '_resolvedDependencies',
  'settingsSchema',
  '_isRoot',
  '_buildFeatures',
].join(',')

interface AppLocator {
  name: string
  version: string
  build?: string
}

export class Apps extends InfraClient {
  // tslint:disable-next-line: variable-name
  private _routes: ReturnType<typeof createRoutes>
  private diskCache: CacheLayer<string, any> | undefined
  private memoryCache: CacheLayer<string, any> | undefined

  private get routes () {
    return this._routes
  }

  constructor(context: IOContext, options?: InstanceOptions) {
    super('apps@0.x', context, options, true)
    this.diskCache = options && options.diskCache
    this.memoryCache = options && options.memoryCache
    this._routes = createRoutes(context)
  }

  public installApp = (descriptor: string) => {
    if (descriptor.startsWith('infra:service-')) {
      return this.installRuntime(descriptor)
    }
    return this.http.post(this.routes.Apps(), { id: descriptor }, { metric: 'apps-install' })
  }

  public uninstallApp = (app: string) => {
    return this.http.delete(this.routes.App(app), { metric: 'apps-uninstall' })
  }

  public acknowledgeApp = (app: string, service: string) => {
    return this.http.put(this.routes.Acknowledge(app, service), null, { metric: 'apps-ack' })
  }

  public link = async (app: string, files: Change[], { zlib }: ZipOptions = {}) => {
    if (!(files[0] && files[0].path)) {
      throw new Error('Argument files must be an array of {path, content}, where content can be a String, a Buffer or a ReadableStream.')
    }

    const emptyChanges = files.filter(file => !file.content)
    if (emptyChanges.length > 0) {
      throw new Error(`Missing content for paths: ${emptyChanges.map(e => e.path).join('; ')}`)
    }

    const indexOfManifest = files.findIndex(({ path }) => path === 'manifest.json')
    if (indexOfManifest === -1) {
      throw new Error('No manifest.json file found in files.')
    }
    const zip = archiver('zip', { zlib })
    // Throw stream errors so they reject the promise chain.
    zip.on('error', (e) => {
      throw e
    })
    const request = this.http.put<AppBundleLinked>(this.routes.Link(app), zip, {
      headers: { 'Content-Type': 'application/zip' },
      metric: 'apps-link',
    })

    files.forEach(({ content, path }) => zip.append(content, { name: path }))
    const finalize = zip.finalize()

    try {
      const [response] = await Promise.all([request, finalize])
      response.bundleSize = zip.pointer()
      return response
    } catch (e) {
      e.bundleSize = zip.pointer()
      throw e
    }
  }

  public patch = async (app: string, changes: Change[], { zlib }: ZipOptions = {}) => {
    if (!(changes[0] && changes[0].path)) {
      throw new Error('Argument changes must be an array of {path, content}, where content can be a String, a Buffer or a ReadableStream.')
    }

    const files = changes.filter(change => !!change.content)
    const deletedFiles = changes
      .filter(change => !change.content)
      .map(change => change.path)
      .join(':')

    const zip = archiver('zip', { zlib })
    // Throw stream errors so they reject the promise chain.
    zip.on('error', (e) => {
      throw e
    })
    const request = this.http.patch(this.routes.Link(app), zip, {
      headers: { 'Content-Type': 'application/zip' },
      metric: 'apps-patch',
      params: { deletedFiles },
    })

    files.forEach(({ content, path }) => zip.append(content, { name: path }))
    const finalize = zip.finalize()

    const [response] = await Promise.all([request, finalize])
    return response
  }

  public unlink = (app: string) => {
    return this.http.delete(this.routes.Unlink(app))
  }

  public unlinkAll = () => {
    return this.http.delete(this.routes.Links())
  }

  public saveAppSettings = (app: string, settings: any) => {
    const headers = {'Content-Type': 'application/json'}
    const metric = 'apps-save'
    return this.http.put(this.routes.Settings(app), settings, {headers, metric})
  }

  public listApps = ({oldVersion, since, service}: ListAppsOptions = {}) => {
    const params = {
      oldVersion,
      service,
      since,
    }
    const metric = 'apps-list'
    const inflightKey = inflightUrlWithQuery
    return this.http.get<AppsList>(this.routes.Apps(), {params, metric, inflightKey})
  }

  public listAppFiles = (app: string, {prefix, nextMarker}: ListFilesOptions = {}) => {
    const locator = parseAppId(app)
    const linked = !!locator.build
    const params = {
      marker: nextMarker,
      prefix,
    }
    const metric = linked ? 'apps-list-files' : 'registry-list-files'
    const inflightKey = inflightUrlWithQuery
    return this.http.get<AppFilesList>(this.routes.Files(locator), {params, metric, inflightKey})
  }

  public listLinks = () => {
    const inflightKey = inflightURL
    return this.http.get<string[]>(this.routes.Links(), {metric: 'apps-list-links', inflightKey})
  }

  public getAppFile = (app: string, path: string, staleIfError?: boolean) => {
    const { logger } = this.context
    const locator = parseAppId(app)
    const linked = !!locator.build
    const inflightKey = inflightURL

    if (staleIfError && this.memoryCache) {
      saveVersion(app, this.memoryCache)
    }

    try {
      return this.http.getBuffer(this.routes.File(locator, path), {
        cacheable: linked ? CacheType.Memory : CacheType.Disk,
        inflightKey,
        metric: linked ? 'apps-get-file' : 'registry-get-file',
      })
    } catch (error) {
      logger.error({ error, message: 'getAppFile failed', app, path })
      if (staleIfError && this.memoryCache) {
        return getFallbackFile(app, path, this.memoryCache, this)
      }
      throw error
    }
  }

  public getAppJSON = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean) => {
    const locator = parseAppId(app)
    const linked = !!locator.build
    const inflightKey = inflightURL
    return this.http.get<T>(this.routes.File(locator, path), {
      cacheable: linked ? CacheType.Memory : CacheType.Any,
      inflightKey,
      metric: linked ? 'apps-get-json' : 'registry-get-json',
      nullIfNotFound,
    } as IgnoreNotFoundRequestConfig)
  }

  public getAppFileStream = (app: string, path: string): Promise<IncomingMessage> => {
    const locator = parseAppId(app)
    const metric = locator.build ? 'apps-get-file-s' : 'registry-get-file-s'
    return this.http.getStream(this.routes.File(locator, path), {metric})
  }

  public getApp = (app: string) => {
    const metric = 'apps-get-app'
    const inflightKey = inflightURL
    return this.http.get<AppManifest>(this.routes.App(app), {metric, inflightKey})
  }

  public getAppSettings = (app: string) => {
    const inflightKey = inflightURL
    const metric = 'apps-get-settings'
    return this.http.get<any>(this.routes.Settings(app), {inflightKey, metric})
  }

  public getAllAppsSettings = (listAppsOptions: ListAppsOptions = {}): Promise<AppsSettings> => {
    return this.listApps(listAppsOptions).then(({data: installedApps}: AppsList) => {
      const names = installedApps.map(getVendorAndName)
      const settingsPromises = names.map(vendorAndName => this.getAppSettings(vendorAndName).catch(notFound))
      return Promise.all(settingsPromises).then((settings: any[]) => {
        return zipObj(names, settings)
      })
    })
  }

  public getAppBundle = (app: string, bundlePath: string, generatePackageJson: boolean): Promise<Readable> => {
    const locator = parseAppId(app)
    const params = generatePackageJson && {_packageJSONEngine: 'npm', _packageJSONFilter: 'vtex.render-builder@x'}
    const metric = locator.build ? 'apps-get-bundle' : 'registry-get-bundle'
    return this.http.getStream(this.routes.AppBundle(locator, bundlePath), {
      headers: {
        Accept: 'application/x-gzip',
        'Accept-Encoding': 'gzip',
      },
      metric,
      params,
    })
  }

  public unpackAppBundle = (app: string, bundlePath: string, unpackPath: string, generatePackageJson: boolean): Promise<Writable> => {
    return this.getAppBundle(app, bundlePath, generatePackageJson)
      .then(stream => stream
        .pipe(createGunzip())
        .pipe(extract(unpackPath))
      )
  }

  public getAppsMetaInfos = async (filter?: string, staleIfError?: boolean) => {
    const { account, workspace, logger } = this.context
    const metric = 'get-apps-meta'
    const inflightKey = inflightURL
    try {
      const appsMetaInfos = await this.http.get<WorkspaceMetaInfo>(this.routes.Meta(), {params: {fields: workspaceFields}, metric, inflightKey}).then(prop('apps'))
      if (staleIfError && this.diskCache) {
        updateMetaInfoCache(this.diskCache, account, workspace, appsMetaInfos, logger)
      }
      if (filter) {
        return ramdaFilter(appMeta => !!ramdaPath(['_resolvedDependencies', filter], appMeta), appsMetaInfos)
      }
      return appsMetaInfos
    } catch (error) {
      if (staleIfError && workspace === 'master' && this.diskCache) {
        return await this.diskCache.get(getMetaInfoKey(account)) || []
      }
      throw error
    }
  }

  public getDependencies = (filter: string = '') => {
    const params = {filter}
    const metric = 'apps-get-deps'
    const inflightKey = inflightUrlWithQuery
    return this.http.get<Record<string, string[]>>(this.routes.Dependencies(), {params, metric, inflightKey})
  }

  public updateDependencies = () => {
    return this.http.put<Record<string, string[]>>(this.routes.Dependencies(), null, {metric: 'apps-update-deps'})
  }

  public updateDependency = (name: string, version: string, registry: string) => {
    return this.http.patch(this.routes.Apps(), [{name, version, registry}], {metric: 'apps-update-dep'})
  }

  public resolveDependencies = (apps: string[], registries: string[], filter: string = '') => {
    const params = {apps, registries, filter}
    const metric = 'apps-resolve-deps'
    const inflightKey = inflightUrlWithQuery
    return this.http.get(this.routes.ResolveDependencies(), {params, metric, inflightKey})
  }

  public resolveDependenciesWithManifest = (manifest: AppManifest, filter: string = '') => {
    const params = {filter}
    const metric = 'apps-resolve-deps-m'
    return this.http.post<Record<string, string[]>>(this.routes.ResolveDependenciesWithManifest(), manifest, {params, metric})
  }

  private installRuntime = (descriptor: string) => {
    const { account, workspace } = this.context
    const [name, version] = descriptor.split('@')
    return this.http.patch(
      `http://apps.aws-us-east-1.vtex.io/${account}/${workspace}/apps`,
      [
        {
          name,
          version,
        },
      ]
    )
  }
}

interface ZipOptions {
  zlib?: ZlibOptions,
}

export interface AppMetaInfo {
  id: string
  settingsSchema?: Record<string, any>
  _resolvedDependencies: Record<string, string>
  _isRoot: boolean
  _buildFeatures: Record<string, string[]>
}

export interface WorkspaceMetaInfo {
  apps: AppMetaInfo[]
}

export interface AppsListItem {
  app: string,
  id: string,
  location: string,
}

export interface AppsList {
  data: AppsListItem[],
}

export interface Change {
  path: string,
  content: string | Readable | Buffer,
}

export interface ListAppsOptions {
  oldVersion?: string,
  context?: string[],
  since?: string,
  service?: string,
}

export interface ListFilesOptions {
  prefix?: string,
  context?: string[],
  nextMarker?: string,
}

export interface AppsSettings {
  [app: string]: any,
}
