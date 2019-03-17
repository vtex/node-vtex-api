import archiver from 'archiver'
import {IncomingMessage} from 'http'
import {stringify} from 'qs'
import {Readable, Writable} from 'stream'
import {extract} from 'tar-fs'
import {createGunzip, ZlibOptions} from 'zlib'

import {DEFAULT_WORKSPACE} from '../constants'
import {HttpClient} from '../HttpClient'
import {HttpClientFactory, IODataSource} from '../IODataSource'
import {AppBundlePublished, AppFilesList, AppManifest} from '../responses'

const EMPTY_OBJECT = {}

const routes = {
  App: (app: string) => `${routes.Registry}/${app}`,
  AppBundle: (app: string, version: string, path: string) => `${routes.AppVersion(app, version)}/bundle/${path}`,
  AppFile: (app: string, version: string, path: string) => `${routes.AppFiles(app, version)}/${path}`,
  AppFiles: (app: string, version: string) => `${routes.AppVersion(app, version)}/files`,
  AppVersion: (app: string, version: string) => `${routes.App(app)}/${version}`,
  Publish: '/v2/registry',
  Registry: '/registry',
  ResolveDependenciesWithManifest: '/v2/registry/_resolve',
}

const forWorkspaceMaster: HttpClientFactory = ({service, context, options}) => (service && context)
  ? HttpClient.forWorkspace(service, {...context, workspace: DEFAULT_WORKSPACE}, options || {})
  : undefined

const paramsSerializer = (params: any) => {
  return stringify(params, {arrayFormat: 'repeat'})
}

export class Registry extends IODataSource {
  protected httpClientFactory = forWorkspaceMaster
  protected service = 'apps'

  public publishApp = async (files: File[], tag?: string, {zlib}: ZipOptions = {}) => {
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
    const request = this.http.post<AppBundlePublished>(routes.Publish, zip, {
      headers: {'Content-Type': 'application/zip'},
      metric,
      params: tag ? {tag} : EMPTY_OBJECT,
    })

    files.forEach(({content, path}) => zip.append(content, {name: path}))
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

  public listApps = () => {
    return this.http.get<RegistryAppsList>(routes.Registry, {metric: 'registry-list'})
  }

  public listVersionsByApp = (app: string) => {
    return this.http.get<RegistryAppVersionsList>(routes.App(app), {metric: 'registry-list-versions'})
  }

  public deprecateApp = (app: string, version: string) => {
    return this.http.patch(routes.AppVersion(app, version), {deprecated: true}, {metric: 'registry-deprecate'})
  }

  public getAppManifest = (app: string, version: string, opts?: AppsManifestOptions) => {
    return this.http.get<AppManifest>(routes.AppVersion(app, version), {params: opts, metric: 'registry-manifest'})
  }

  public listAppFiles = (app: string, version: string, opts?: ListAppFilesOptions) => {
    return this.http.get<AppFilesList>(routes.AppFiles(app, version), {params: opts, metric: 'registry-list-files'})
  }

  public getAppFile = (app: string, version: string, path: string) => {
    return this.http.getBuffer(routes.AppFile(app, version, path), {metric: 'registry-get-file'})
  }

  public getAppFileStream = (app: string, version: string, path: string): Promise<IncomingMessage> => {
    return this.http.getStream(routes.AppFile(app, version, path), {metric: 'registry-get-file-s'})
  }

  public getAppBundle = (app: string, version: string, bundlePath: string, generatePackageJson: boolean): Promise<Readable> => {
    const params = generatePackageJson && {_packageJSONEngine: 'npm', _packageJSONFilter: 'vtex.render-builder@x'}
    const metric = 'registry-get-bundle'
    return this.http.getStream(routes.AppBundle(app, version, bundlePath), {
      headers: {
        Accept: 'application/x-gzip',
        'Accept-Encoding': 'gzip',
      },
      metric,
      params,
    })
  }

  public unpackAppBundle = (app: string, version: string, bundlePath: string, unpackPath: string, generatePackageJson: boolean): Promise<Writable> => {
    return this.getAppBundle(app, version, bundlePath, generatePackageJson)
      .then(stream => stream
        .pipe(createGunzip())
        .pipe(extract(unpackPath))
      )
  }

  public resolveDependenciesWithManifest = (manifest: AppManifest, filter: string = '') => {
    const params = {filter}
    const metric = 'registry-resolve-deps'
    return this.http.post<Record<string, string[]>>(routes.ResolveDependenciesWithManifest, manifest, {params, paramsSerializer, metric})
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
