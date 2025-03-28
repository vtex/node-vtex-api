import archiver from 'archiver'
import { IncomingMessage } from 'http'
import { Readable, Writable } from 'stream'
import { extract } from 'tar-fs'
import { createGunzip, ZlibOptions } from 'zlib'

import { DEFAULT_WORKSPACE } from '../../constants'
import {
  CacheType,
  inflightURL,
  inflightUrlWithQuery,
  InstanceOptions,
  RequestTracingConfig,
} from '../../HttpClient'
import {
  IgnoreNotFoundRequestConfig,
} from '../../HttpClient/middlewares/notFound'
import { AppBundlePublished, AppFilesList, AppManifest, AppState } from '../../responses'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

const EMPTY_OBJECT = {}

const routes = {
  App: (app: string) => `${routes.Registry}/${app}`,
  AppBundle: (app: string, version: string, path?: string) => {
    return path ? `${routes.AppVersion(app, version)}/bundle/${path}` : `${routes.AppVersion(app, version)}/bundle`
  },
  AppFile: (app: string, version: string, path: string) => `${routes.AppFiles(app, version)}/${path}`,
  AppFiles: (app: string, version: string) => `${routes.AppVersion(app, version)}/files`,
  AppState: (app: string, version: string) => `${routes.AppVersion(app, version)}/state`,
  AppVersion: (app: string, version: string) => `${routes.App(app)}/${version}`,
  Publish: '/v2/registry',
  PublishRc: '/v2/registry/rc',
  Registry: '/registry',
  ResolveDependenciesWithManifest: '/v2/registry/_resolve',
}

export class Registry extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('apps@0.x', {...context, workspace: DEFAULT_WORKSPACE}, options)
  }

  public getAppState = (app: string, version: string, tracingConfig?: RequestTracingConfig) => {

    const metric = 'registry-app-state'

    const inflightKey = inflightUrlWithQuery
    return this.http.get<AppState>(routes.AppState(app, version), {
      inflightKey,
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public publishApp = (files: File[], tag?: string, {zlib}: ZipOptions = {}, tracingConfig?: RequestTracingConfig) => {
    return this.publish(routes.Publish, files, tag, {zlib}, tracingConfig)
  }

  public publishAppRc = (files: File[], tag?: string, {zlib}: ZipOptions = {}, tracingConfig?: RequestTracingConfig) => {
    return this.publish(routes.PublishRc, files, tag, {zlib}, tracingConfig)
  }

  public listApps = (tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightURL
    const metric = 'registry-list'
    return this.http.get<RegistryAppsList>(routes.Registry, {inflightKey, metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public listVersionsByApp = (app: string, tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightURL
    const metric = 'registry-list-versions'
    return this.http.get<RegistryAppVersionsList>(routes.App(app), {inflightKey, metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public deprecateApp = (app: string, version: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'registry-deprecate'
    return this.http.patch(routes.AppVersion(app, version), {patchState: 'deprecate'}, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public undeprecateApp = (app: string, version: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'registry-undeprecate'
    return this.http.patch(routes.AppVersion(app, version), {patchState: 'undeprecate'}, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public validateApp = (app: string, version: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'registry-validate'
    return this.http.patch(routes.AppVersion(app, version), {patchState: 'validate'}, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public getAppManifest = (app: string, version: string, opts?: AppsManifestOptions, tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightUrlWithQuery
    const params = opts
    const metric = 'registry-manifest'
    return this.http.get<AppManifest>(routes.AppVersion(app, version), {inflightKey, metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public listAppFiles = (app: string, version: string, opts?: ListAppFilesOptions, tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightUrlWithQuery
    const params = opts
    const metric = 'registry-list-files'
    return this.http.get<AppFilesList>(routes.AppFiles(app, version), {inflightKey, metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public getAppFile = (app: string, version: string, path: string, tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightURL
    const metric = 'registry-get-file'
    return this.http.getBuffer(routes.AppFile(app, version, path), {
      cacheable: CacheType.Disk,
      inflightKey,
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getAppJSON = <T extends object | null>(app: string, version: string, path: string, nullIfNotFound?: boolean, tracingConfig?: RequestTracingConfig) => {
    const inflightKey = inflightURL
    const metric = 'registry-get-json'
    return this.http.get<T>(routes.AppFile(app, version, path), {
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

  public getAppFileStream = (app: string, version: string, path: string, tracingConfig?: RequestTracingConfig): Promise<IncomingMessage> => {
    const metric = 'registry-get-file-s'
    return this.http.getStream(routes.AppFile(app, version, path), {
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getAppBundle = (app: string, version: string, bundlePath: string, generatePackageJson: boolean, tracingConfig?: RequestTracingConfig): Promise<Readable> => {
    const params = generatePackageJson && {_packageJSONEngine: 'npm', _packageJSONFilter: 'vtex.render-builder@x'}
    const metric = 'registry-get-bundle'
    return this.http.getStream(routes.AppBundle(app, version, bundlePath), {
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

  public unpackAppBundle = (app: string, version: string, bundlePath: string, unpackPath: string, generatePackageJson: boolean, tracingConfig?: RequestTracingConfig): Promise<Writable> => {
    return this.getAppBundle(app, version, bundlePath, generatePackageJson, tracingConfig)
      .then(stream => stream
        .pipe(createGunzip())
        .pipe(extract(unpackPath))
      )
  }

  public resolveDependenciesWithManifest = (manifest: AppManifest, filter: string = '', tracingConfig?: RequestTracingConfig) => {
    const params = {filter}
    const metric = 'registry-resolve-deps'
    return this.http.post<Record<string, string[]>>(routes.ResolveDependenciesWithManifest, manifest, {metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  private publish = async (route: string, files: File[], tag?: string, {zlib}: ZipOptions = {}, tracingConfig?: RequestTracingConfig) => {
    if (!(files[0] && files[0].path && files[0].content)) {
      throw new Error('Argument files must be an array of {path, content}, where content can be a String, a Buffer or a ReadableStream.')
    }
    const indexOfManifest = files.findIndex(({path}) => path === 'manifest.json')
    if (indexOfManifest === -1) {
      throw new Error('No manifest.json file found in files.')
    }
    const zip = archiver('zip', {zlib})
    // Throw stream errors so they reject the promise chain.
    zip.on('error', (e) => {
      throw e
    })
    const metric = 'registry-publish'
    const request = this.http.post<AppBundlePublished>(route, zip, {
      headers: {'Content-Type': 'application/zip'},
      metric,
      params: tag ? {tag} : EMPTY_OBJECT,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })

    files.forEach(({content, path}) => zip.append(content, {name: path}))
    const finalize = zip.finalize()

    try {
      const [response] = await Promise.all([request, finalize])
      response.bundleSize = zip.pointer()
      return response
    } catch (e) {
      // See Apps.ts `link` method for more information on this cast
      (e as Error & { bundleSize: number }).bundleSize = zip.pointer()
      throw e
    }
  }
}

interface ZipOptions {
  zlib?: ZlibOptions,
}

export interface AppsManifestOptions {
  resolveDeps: boolean,
}

export interface ListAppFilesOptions {
  prefix: string,
}

export interface RegistryAppsListItem {
  partialIdentifier: string,
  location: string,
}

export interface RegistryAppsList {
  data: RegistryAppsListItem[],
}

export interface RegistryAppVersionsListItem {
  versionIdentifier: string,
  location: string,
}

export interface RegistryAppVersionsList {
  data: RegistryAppVersionsListItem[],
}

export interface File {
  path: string,
  content: any,
}
