/* @flow */
import {extract} from 'tar-fs'
import {createGunzip} from 'zlib'
import {createClient, createWorkspaceURL, noTransforms} from './baseClient'
import type {InstanceOptions} from './baseClient'

type Change = {
  path: string,
  content: string
}

type ListSettings = {
  oldVersion: string,
  context: Array<string>,
  since: string,
  service: string,
}

type ListFilesSettings = {
  prefix: string,
  context: Array<string>,
  nextMarker: string,
}

const routes = {
  Apps: '/apps',

  App: (app: string) =>
    `${routes.Apps}/${app}`,

  Links: '/links',

  Link: (app: string) =>
    `${routes.Links}/${app}`,

  Acknowledge: (app: string, service: string) =>
    `${routes.App(app)}/acknowledge/${service}`,

  Settings: (app: string) =>
    `${routes.App(app)}/settings`,

  Files: (app: string) =>
    `${routes.App(app)}/files`,

  File: (app: string, path: string) =>
    `${routes.Files(app)}/${path}`,

  AppBundle: (app: string, path: string) =>
    `${routes.App(app)}/bundle?rootFolder=${path}`,

  Dependencies: '/dependencies',
}

const contextQuery = (context?: Array<string>) => context ? context.join('/') : context

export type AppsInstance = {
  installApp: (descriptor: string, registry: string) => any,
  uninstallApp: (app: string) => any,
  acknowledgeApp: (app: string, service: string) => any,
  link: (app: string, changes: Array<Change>) => any,
  unlink: (app: string) => any,
  saveAppSettings: (app: string, settings: any) => any,
  listApps: (settings: ListSettings) => any,
  listAppFiles: (app: string, settings: ListFilesSettings) => any,
  listLinks: () => any,
  getAppFile: (app: string, path: string, context?: Array<string>) => any,
  getApp: (app: string, context?: Array<string>) => any,
  getAppBundle: (app: string, bundlePath: string) => any,
  unpackAppBundle: (app: string, bundlePath: string, unpackPath: string) => any,
  getDependencies: (filter?: string) => any,
  updateDependencies: () => any,
}

export default function Apps (opts: InstanceOptions): AppsInstance {
  const client = createClient({...opts, baseURL: createWorkspaceURL('apps', opts)})

  const apps = {
    installApp: (descriptor: string, registry: string) => {
      return client.post(routes.Apps, {id: descriptor, registry: registry})
    },

    uninstallApp: (app: string) => {
      return client.delete(routes.App(app))
    },

    acknowledgeApp: (app: string, service: string) => {
      return client.put(routes.Acknowledge(app, service))
    },

    link: (app: string, changes: Array<Change>) => {
      const headers = {
        'Content-Type': 'application/json',
      }
      return client.put(routes.Link(app), changes, {headers})
    },

    unlink: (app: string) => {
      return client.delete(routes.Link(app))
    },

    saveAppSettings: (app: string, settings: any) => {
      const headers = {
        'Content-Type': 'application/json',
      }
      return client.put(routes.Settings(app), settings, {headers})
    },

    listApps: ({oldVersion, context, since, service}: ListSettings = {}) => {
      const params = {
        oldVersion,
        context: contextQuery(context),
        since,
        service,
      }
      return client(routes.Apps, {params})
    },

    listAppFiles: (app: string, {prefix, context, nextMarker}: ListFilesSettings = {}) => {
      const params = {
        prefix,
        context: contextQuery(context),
        marker: nextMarker,
      }
      return client(routes.Files(app), {params})
    },

    listLinks: () => {
      return client(routes.Links)
    },

    getAppFile: (app: string, path: string, context: Array<string> = []) => {
      const params = {context: contextQuery(context)}
      return client(routes.File(app, path), {params, responseType: 'arraybuffer', transformResponse: noTransforms})
    },

    getApp: (app: string, context: Array<string> = []) => {
      const params = {context: contextQuery(context)}
      return client(routes.App(app), {params})
    },

    getAppSettings: (app: string) => {
      return client(routes.Settings(app))
    },

    getAppBundle: (app: string, bundlePath: string) => {
      return client(routes.AppBundle(app, bundlePath), {
        responseType: 'stream',
        transformResponse: noTransforms,
        headers: {
          'Accept': 'application/x-gzip',
          'Accept-Encoding': 'gzip',
        },
      })
    },

    unpackAppBundle: async (app: string, bundlePath: string, unpackPath: string) => {
      (await apps.getAppBundle(app, bundlePath))
        .pipe(createGunzip())
        .pipe(extract(unpackPath))
    },

    getDependencies: (filter: string = '') => {
      const params = {filter}
      return client(routes.Dependencies, {params})
    },

    updateDependencies: () => {
      return client({
        method: 'PUT',
        url: routes.Dependencies,
      })
    },
  }

  return apps
}
