import * as archiver from 'archiver'
import {IncomingMessage} from 'http'
import {stringify} from 'qs'
import {Readable, Writable} from 'stream'
import {extract} from 'tar-fs'
import {createGunzip, ZlibOptions} from 'zlib'

import {HttpClient, InstanceOptions, IOContext} from './HttpClient'
import {AppBundleLinked, AppFilesList, AppManifest} from './responses'

const routes = {
  Acknowledge: (app: string, service: string) => `${routes.App(app)}/acknowledge/${service}`,
  App: (app: string) => `${routes.Apps}/${app}`,
  AppBundle: (app: string, path: string) => `${routes.App(app)}/bundle/${path}`,
  Apps: '/apps',
  Dependencies: '/dependencies',
  File: (app: string, path: string) => `${routes.Files(app)}/${path}`,
  Files: (app: string) => `${routes.App(app)}/files`,
  Link: (app: string) => `/v2/links/${app}`,
  Links: '/links',
  ResolveDependencies: 'dependencies/_resolve',
  Settings: (app: string) => `${routes.App(app)}/settings`,
  Unlink: (app: string) => `${routes.Links}/${app}`,
}

const contextQuery = (context?: string[]) => context ? context.join('/') : context
const getVendorAndName = ({id}: {id: string}) => id.split('@')[0]
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

const paramsSerializer = (params: any) => {
  return stringify(params, {arrayFormat: 'repeat'})
}

export class Apps {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forWorkspace('apps', ioContext, opts)
  }

  public installApp = (descriptor: string) => {
    return this.http.post(routes.Apps, {id: descriptor})
  }

  public uninstallApp = (app: string) => {
    return this.http.delete(routes.App(app))
  }

  public acknowledgeApp = (app: string, service: string) => {
    return this.http.put(routes.Acknowledge(app, service))
  }

  public link = async (app: string, files: Change[], {zlib}: ZipOptions = {}) => {
    if (!(files[0] && files[0].path)) {
      throw new Error('Argument files must be an array of {path, content}, where content can be a String, a Buffer or a ReadableStream.')
    }

    const emptyChanges = files.filter(file => !file.content)
    if (emptyChanges.length > 0) {
      throw new Error(`Missing content for paths: ${emptyChanges.map(e => e.path).join('; ')}`)
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
    const request = this.http.put<AppBundleLinked>(routes.Link(app), zip, {
      headers: {'Content-Type': 'application/zip'},
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

  public patch = async (app: string, changes: Change[], {zlib}: ZipOptions = {}) => {
    if (!(changes[0] && changes[0].path)) {
      throw new Error('Argument changes must be an array of {path, content}, where content can be a String, a Buffer or a ReadableStream.')
    }

    const files = changes.filter(change => !!change.content)
    const deletedFiles = changes
      .filter(change => !change.content)
      .map(change => change.path)
      .join(':')

    const zip = archiver('zip', {zlib})
    // Throw stream errors so they reject the promise chain.
    zip.on('error', (e) => {
      throw e
    })
    const request = this.http.patch(routes.Link(app), zip, {
      headers: {'Content-Type': 'application/zip'},
      params: {deletedFiles},
    })

    files.forEach(({content, path}) => zip.append(content, {name: path}))
    const finalize = zip.finalize()

    const [response] = await Promise.all([request, finalize])
    return response
  }

  public unlink = (app: string) => {
    return this.http.delete(routes.Unlink(app))
  }

  public unlinkAll = () => {
    return this.http.delete(routes.Links)
  }

  public saveAppSettings = (app: string, settings: any) => {
    const headers = {'Content-Type': 'application/json'}
    return this.http.put(routes.Settings(app), settings, {headers})
  }

  public listApps = ({oldVersion, context, since, service}: ListAppsOptions = {}) => {
    const params = {
      context: contextQuery(context),
      oldVersion,
      service,
      since,
    }
    return this.http.get<AppsList>(routes.Apps, {params})
  }

  public listAppFiles = (app: string, {prefix, context, nextMarker}: ListFilesOptions = {}) => {
    const params = {
      context: contextQuery(context),
      marker: nextMarker,
      prefix,
    }
    return this.http.get<AppFilesList>(routes.Files(app), {params})
  }

  public listLinks = () => {
    return this.http.get<string[]>(routes.Links)
  }

  public getAppFile = (app: string, path: string, context: string[] = []) => {
    const params = {context: contextQuery(context)}
    return this.http.getBuffer(routes.File(app, path), {params})
  }

  public getAppFileStream = (app: string, path: string, context: string[] = []): Promise<IncomingMessage> => {
    const params = {context: contextQuery(context)}
    return this.http.getStream(routes.File(app, path), {params})
  }

  public getApp = (app: string, context: string[] = []) => {
    const params = {context: contextQuery(context)}
    return this.http.get<AppManifest>(routes.App(app), {params})
  }

  public getAppSettings = (app: string) => {
    return this.http.get<any>(routes.Settings(app))
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
    const params = generatePackageJson && {_packageJSONEngine: 'npm', _packageJSONFilter: 'vtex.render-builder@x'}
    return this.http.getStream(routes.AppBundle(app, bundlePath), {
      headers: {
        Accept: 'application/x-gzip',
        'Accept-Encoding': 'gzip',
      },
      params,
    })
  }

  public unpackAppBundle = (app: string, bundlePath: string, unpackPath: string, generatePackageJson: boolean): Promise<Writable> => {
    return this.getAppBundle(app, bundlePath, generatePackageJson)
      .then(stream => stream
        .pipe(createGunzip())
        .pipe(extract(unpackPath)),
      )
  }

  public getDependencies = (filter: string = '') => {
    const params = {filter}
    return this.http.get<Record<string, string[]>>(routes.Dependencies, {params})
  }

  public updateDependencies = () => {
    return this.http.put<Record<string, string[]>>(routes.Dependencies)
  }

  public updateDependency = (name: string, version: string, registry: string) => {
    return this.http.patch(routes.Apps, [{name, version, registry}])
  }

  public resolveDependencies = (apps: string[], registries: string[], filter: string = '') => {
    const params = {apps, registries, filter}
    return this.http.get(routes.ResolveDependencies, {params, paramsSerializer})
  }
}

interface ZipOptions {
  zlib?: ZlibOptions,
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
