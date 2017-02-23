/* @flow */
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

  Dependencies: '/dependencies',
}

const contextQuery = (context?: Array<string>) => context ? context.join('/') : context

export type AppsInstance = {
  installApp: (descriptor: string) => any,
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
  getDependencies: (filter?: string) => any,
}

export default function Apps (opts: InstanceOptions): AppsInstance {
  const client = createClient({...opts, baseURL: createWorkspaceURL('apps', opts)})

  return {
    installApp: (descriptor: string) => {
      return client.post(routes.Apps, {id: descriptor})
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

    getDependencies: (filter: string = '') => {
      const params = {filter}
      return client(routes.Dependencies, {params})
    },
  }
}
