import archiver from 'archiver'
import { IncomingMessage } from 'http'
import { Readable, Writable } from 'stream'
import { extract } from 'tar-fs'
import { createGunzip, ZlibOptions } from 'zlib'

import { CacheLayer } from '../..'
import {
  cacheKey,
  CacheType,
  inflightURL,
  inflightUrlWithQuery,
  InstanceOptions,
  RequestKeyGenerator,
  RequestTracingConfig,
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
    FileFromApps: (app: string, path: string) => `${routes.Workspace}/apps/${app}/files/${path}`,
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

const removeAccountAndWorkspace = (path: string) => {
  const accountIndex = 0
  const workspaceIndex = path.indexOf('/', accountIndex + 1)
  const registryIndex = path.indexOf('/', workspaceIndex + 1)
  return path.slice(registryIndex)
}

const registryCacheKey: RequestKeyGenerator = (config) => {
  const { baseURL = '', url = '', params, headers } = config
  return cacheKey({ baseURL, url: removeAccountAndWorkspace(url), params, headers })
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

// 🚨🚨🚨
// In order to make changes in here, please also change the colossus App so we
// share the same cache key and do NOT call Apps unecessarily
const workspaceFields = [
  '_activationDate',
  '_buildFeatures',
  '_isRoot',
  '_resolvedDependencies',
  'credentialType',
  'link',
  'name',
  'registry',
  'settingsSchema',
  'vendor',
  'version',
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

  public installApp = (descriptor: string, tracingConfig?: RequestTracingConfig) => {
    if (descriptor.startsWith('infra:service-')) {
      return this.installRuntime(descriptor, tracingConfig)
    }

    const metric = 'apps-install' 
    return this.http.post<AppInstallResponse>(
      this.routes.Apps(),
      { id: descriptor },
      { 
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      }
    )
  }

  public uninstallApp = (app: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'apps-uninstall' 
    return this.http.delete(this.routes.App(app), { 
      metric, 
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public acknowledgeApp = (app: string, service: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'apps-ack' 
    return this.http.put(this.routes.Acknowledge(app, service), null, { 
      metric, 
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public link = async (app: string, files: Change[], { zlib }: ZipOptions = {}, tracingConfig?: RequestTracingConfig) => {
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

    const metric = 'apps-link'
    const request = this.http.put<AppBundleLinked>(this.routes.Link(app), zip, {
      headers: { 'Content-Type': 'application/zip' },
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
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

  public patch = async (app: string, changes: Change[], { zlib }: ZipOptions = {}, tracingConfig?: RequestTracingConfig) => {
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

    const metric = 'apps-patch' 
    const request = this.http.patch(this.routes.Link(app), zip, {
      headers: { 'Content-Type': 'application/zip' },
      metric,
      params: { deletedFiles },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })

    files.forEach(({ content, path }) => zip.append(content, { name: path }))
    const finalize = zip.finalize()

    const [response] = await Promise.all([request, finalize])
    return response
  }

  public unlink = (app: string, tracingConfig?: RequestTracingConfig) => {
    return this.http.delete(this.routes.Unlink(app), {
      tracing: {
        requestSpanNameSuffix: 'apps-unlink',
        ...tracingConfig?.tracing,
      },
    })
  }

  public unlinkAll = (tracingConfig?: RequestTracingConfig) => {
    return this.http.delete(this.routes.Links(), {
      tracing: {
        requestSpanNameSuffix: 'apps-unlink-all',
        ...tracingConfig?.tracing,
      },
    })
  }

  public saveAppSettings = (app: string, settings: any, tracingConfig?: RequestTracingConfig) => {
    const headers = {'Content-Type': 'application/json'}
    const metric = 'apps-save'
    return this.http.put(this.routes.Settings(app), settings, {
      headers, 
      metric, 
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public listApps = ({oldVersion, since, service}: ListAppsOptions = {}, tracingConfig?: RequestTracingConfig) => {
    const params = {
      oldVersion,
      service,
      since,
    }
    const metric = 'apps-list'
    const inflightKey = inflightUrlWithQuery
    return this.http.get<AppsList>(this.routes.Apps(), {
      inflightKey,
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public listAppFiles = (app: string, {prefix, nextMarker}: ListFilesOptions = {}, tracingConfig?: RequestTracingConfig) => {
    const locator = parseAppId(app)
    const linked = !!locator.build
    const params = {
      marker: nextMarker,
      prefix,
    }
    const metric = linked ? 'apps-list-files' : 'registry-list-files'
    const inflightKey = inflightUrlWithQuery
    return this.http.get<AppFilesList>(this.routes.Files(locator), {
      inflightKey,
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public listLinks = (tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightURL
    const metric = 'apps-list-links' 
    return this.http.get<string[]>(this.routes.Links(), {
      inflightKey,
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getAppFile = (app: string, path: string, staleIfError?: boolean, tracingConfig?: RequestTracingConfig) => {
    const { logger } = this.context
    const locator = parseAppId(app)
    const linked = !!locator.build
    const inflightKey = linked ? inflightURL : registryCacheKey

    if (staleIfError && this.memoryCache) {
      saveVersion(app, this.memoryCache)
    }

    const metric = linked ? 'apps-get-file' : 'registry-get-file'

    try {
      return this.http.getBuffer(this.routes.File(locator, path), {
        cacheKey: linked ? undefined : registryCacheKey,
        cacheable: linked ? CacheType.Memory : CacheType.Disk,
        inflightKey,
        metric,
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      })
    } catch (error) {
      logger.error({ error, message: 'getAppFile failed', app, path })
      if (staleIfError && this.memoryCache) {
        return getFallbackFile(app, path, this.memoryCache, this)
      }
      throw error
    }
  }

  public getAppJSON = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) => {
    const locator = parseAppId(app)
    const linked = !!locator.build
    const inflightKey = linked ? inflightURL : registryCacheKey
    const metric = linked ? 'apps-get-json' : 'registry-get-json'
    return this.http.get<T>(this.routes.File(locator, path), {
      cacheKey: linked ? null : registryCacheKey,
      cacheable: linked ? CacheType.Memory : CacheType.Any,
      inflightKey,
      metric,
      nullIfNotFound,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    } as IgnoreNotFoundRequestConfig)
  }

  public getFileFromApps = <T extends object | null>(app: string, path: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightURL
    const metric = 'get-file-from-apps' 
    return this.http.get<T>(this.routes.FileFromApps(app, path), {
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

  public getAppFileStream = (app: string, path: string, tracingConfig?: RequestTracingConfig): Promise<IncomingMessage> => {
    const locator = parseAppId(app)
    const metric = locator.build ? 'apps-get-file-s' : 'registry-get-file-s'
    return this.http.getStream(this.routes.File(locator, path), {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getApp = (app: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'apps-get-app'
    const inflightKey = inflightURL
    return this.http.get<AppManifest>(this.routes.App(app), {
      inflightKey,
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getAppSettings = (app: string, tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightURL
    const metric = 'apps-get-settings'
    return this.http.get<any>(this.routes.Settings(app), {
      inflightKey,
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getAllAppsSettings = (listAppsOptions: ListAppsOptions = {}, tracingConfig?: RequestTracingConfig): Promise<AppsSettings> => {
    return this.listApps(listAppsOptions, tracingConfig).then(({data: installedApps}: AppsList) => {
      const names = installedApps.map(getVendorAndName)
      const settingsPromises = names.map(vendorAndName => this.getAppSettings(vendorAndName, tracingConfig).catch(notFound))
      return Promise.all(settingsPromises).then((settings: any[]) => {
        return zipObj(names, settings)
      })
    })
  }

  public getAppBundle = (app: string, bundlePath: string, generatePackageJson: boolean, tracingConfig?: RequestTracingConfig): Promise<Readable> => {
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
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public unpackAppBundle = (app: string, bundlePath: string, unpackPath: string, generatePackageJson: boolean, tracingConfig?: RequestTracingConfig): Promise<Writable> => {
    return this.getAppBundle(app, bundlePath, generatePackageJson, tracingConfig)
      .then(stream => stream
        .pipe(createGunzip())
        .pipe(extract(unpackPath))
      )
  }

  public getAppsMetaInfos = async (filter?: string, staleWhileRevalidate: boolean = true, tracingConfig?: RequestTracingConfig) => {
    const { account, production, recorder, workspace, logger} = this.context
    const metric = 'get-apps-meta'
    const inflightKey = inflightURL
    const key = getMetaInfoKey(account, workspace)

    const cachedResponse: StaleWorkspaceMetaInfo | undefined = production && staleWhileRevalidate
      ? await this.diskCache?.get(key)
      : undefined

    if (cachedResponse && recorder) {
      recorder.record(cachedResponse.headers)
    }

    const metaInfoPromise = this.http
      .getRaw<WorkspaceMetaInfo>(this.routes.Meta(), {
        ignoreRecorder: Boolean(cachedResponse),
        inflightKey,
        metric,
        params: { fields: workspaceFields },
        tracing: {
          requestSpanNameSuffix: metric,
          ...tracingConfig?.tracing,
        },
      })
      .then(response => {
        const { data, headers: responseHeaders } = response
        if (this.diskCache && production) {
          this.diskCache.set(key, {
            appsMetaInfo: data.apps || [],
            headers: responseHeaders,
          })
        }
        return response
      })

    let appsMetaInfo: AppMetaInfo[]
    if (cachedResponse) {
      appsMetaInfo = cachedResponse.appsMetaInfo
      metaInfoPromise.catch(error => {
        logger.warn({ message: 'Unable to update stale cache', error })
      })
    } else {
      appsMetaInfo = await metaInfoPromise.then(response => response.data.apps)
    }

    if (filter) {
      return appsMetaInfo.filter(appMeta => appMeta?._resolvedDependencies?.filter)
    }

    return appsMetaInfo
  }

  public getDependencies = (filter: string = '', tracingConfig?: RequestTracingConfig) => {
    const params = {filter}
    const metric = 'apps-get-deps'
    const inflightKey = inflightUrlWithQuery
    return this.http.get<Record<string, string[]>>(this.routes.Dependencies(), {
      inflightKey,
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public updateDependencies = (tracingConfig?: RequestTracingConfig) => {
    const metric = 'apps-update-deps' 
    return this.http.put<Record<string, string[]>>(this.routes.Dependencies(), null, {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public updateDependency = (name: string, version: string, registry: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'apps-update-dep' 
    return this.http.patch(this.routes.Apps(), [{name, version, registry}], {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public resolveDependencies = (apps: string[], registries: string[], filter: string = '', tracingConfig?: RequestTracingConfig) => {
    const params = {apps, registries, filter}
    const metric = 'apps-resolve-deps'
    const inflightKey = inflightUrlWithQuery
    return this.http.get(this.routes.ResolveDependencies(), {
      inflightKey,
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public resolveDependenciesWithManifest = (manifest: AppManifest, filter: string = '', tracingConfig?: RequestTracingConfig) => {
    const params = {filter}
    const metric = 'apps-resolve-deps-m'
    return this.http.post<Record<string, string[]>>(this.routes.ResolveDependenciesWithManifest(), manifest, {
      metric,
      params,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  private installRuntime = (descriptor: string, tracingConfig?: RequestTracingConfig) => {
    const { account, workspace } = this.context
    const [name, version] = descriptor.split('@')
    return this.http.patch(
      `http://apps.aws-us-east-1.vtex.io/${account}/${workspace}/apps`,
      [
        {
          name,
          version,
        },
      ],
      {
        tracing: {
          requestSpanNameSuffix: 'apps-install-runtime',
          ...tracingConfig?.tracing,
        },
      }
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


interface StaleWorkspaceMetaInfo {
  appsMetaInfo: AppMetaInfo[]
  headers: any
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

export interface AppInstallResponse {
  message: string
}
