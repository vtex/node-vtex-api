import {extract} from 'tar-fs'
import {createGunzip} from 'zlib'
import {IncomingMessage} from 'http'
import {Readable, Writable} from 'stream'

import {HttpClient, InstanceOptions} from './HttpClient'
import {AppManifest, AppFilesList} from './responses'

const routes = {
  Apps: '/apps',
  App: (app: string) => `${routes.Apps}/${app}`,
  Links: '/links',
  Link: (app: string) => `${routes.Links}/${app}`,
  Acknowledge: (app: string, service: string) => `${routes.App(app)}/acknowledge/${service}`,
  Settings: (app: string) => `${routes.App(app)}/settings`,
  Files: (app: string) => `${routes.App(app)}/files`,
  File: (app: string, path: string) => `${routes.Files(app)}/${path}`,
  AppBundle: (app: string, path: string) => `${routes.App(app)}/bundle/${path}`,
  Dependencies: '/dependencies',
  ResolveDependencies: 'dependencies/_resolve',
}

const contextQuery = (context?: string[]) => context ? context.join('/') : context

export class Apps {
  private http: HttpClient

  constructor (opts: InstanceOptions) {
    this.http = HttpClient.forWorkspace('apps', opts)
  }

  installApp = (descriptor: string, registry: string) => {
    return this.http.post(routes.Apps, {id: descriptor, registry})
  }

  uninstallApp = (app: string) => {
    return this.http.delete(routes.App(app))
  }

  acknowledgeApp = (app: string, service: string) => {
    return this.http.put(routes.Acknowledge(app, service))
  }

  link = (app: string, changes: Change[]) => {
    const headers = {'Content-Type': 'application/json'}
    return this.http.put(routes.Link(app), changes, {headers})
  }

  unlink = (app: string) => {
    return this.http.delete(routes.Link(app))
  }

  saveAppSettings = (app: string, settings: any) => {
    const headers = {'Content-Type': 'application/json'}
    return this.http.put(routes.Settings(app), settings, {headers})
  }

  listApps = ({oldVersion, context, since, service}: ListAppsOptions = {}) => {
    const params = {
      oldVersion,
      context: contextQuery(context),
      since,
      service,
    }
    return this.http.get<AppsList>(routes.Apps, {params})
  }

  listAppFiles = (app: string, {prefix, context, nextMarker}: ListFilesOptions = {}) => {
    const params = {
      prefix,
      context: contextQuery(context),
      marker: nextMarker,
    }
    return this.http.get<AppFilesList>(routes.Files(app), {params})
  }

  listLinks = () => {
    return this.http.get<string[]>(routes.Links)
  }

  getAppFile = (app: string, path: string, context: Array<string> = []) => {
    const params = {context: contextQuery(context)}
    return this.http.getBuffer(routes.File(app, path), {params})
  }

  getAppFileStream = (app: string, path: string, context: Array<string> = []): Promise<IncomingMessage> => {
    const params = {context: contextQuery(context)}
    return this.http.getStream(routes.File(app, path), {params})
  }

  getApp = (app: string, context: Array<string> = []) => {
    const params = {context: contextQuery(context)}
    return this.http.get<AppManifest>(routes.App(app), {params})
  }

  getAppSettings = (app: string) => {
    return this.http.get<any>(routes.Settings(app))
  }

  getAppBundle = (app: string, bundlePath: string, generatePackageJson: boolean): Promise<Readable> => {
    const params = generatePackageJson && {_packageJSONEngine: 'npm', _packageJSONFilter: 'vtex.render-builder@x'}
    return this.http.getStream(routes.AppBundle(app, bundlePath), {
      params,
      headers: {
        Accept: 'application/x-gzip',
        'Accept-Encoding': 'gzip',
      },
    })
  }

  unpackAppBundle = (app: string, bundlePath: string, unpackPath: string, generatePackageJson: boolean): Promise<Writable> => {
    return this.getAppBundle(app, bundlePath, generatePackageJson)
      .then(stream => stream
        .pipe(createGunzip())
        .pipe(extract(unpackPath)),
      )
  }

  getDependencies = (filter: string = '') => {
    const params = {filter}
    return this.http.get<Record<string, string[]>>(routes.Dependencies, {params})
  }

  updateDependencies = () => {
    return this.http.put<Record<string, string[]>>(routes.Dependencies)
  }

  updateDependency = (name: string, version: string, registry: string) => {
    return this.http.patch(routes.Apps, [{name, version, registry}])
  }

  resolveDependencies = (apps: string[], registries: string[]) => {
    const params = {apps: `apps=${apps.join(',')}`, registries: `registries=${registries.join(',')}`}
    return this.http.get(routes.ResolveDependencies, {params})
  }
}

export type AppsListItem = {
  app: string,
  id: string,
  location: string,
}

export type AppsList = {
  data: AppsListItem[],
}

export type Change = {
  path: string,
  content: string,
}

export type ListAppsOptions = {
  oldVersion?: string,
  context?: string[],
  since?: string,
  service?: string,
}

export type ListFilesOptions = {
  prefix?: string,
  context?: string[],
  nextMarker?: string,
}
