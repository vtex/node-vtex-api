/* @flow */
import {createClient, createWorkspaceURL, noTransforms} from './client'
import type {InstanceOptions} from './client'

type Context = {
  context: Array<string>
}

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

export default function Apps (opts: InstanceOptions) {
  const client = createClient({...opts, baseURL: createWorkspaceURL('apps', opts)})

  return {
    installApp: (descriptor: string) => {
      return client.post(routes.Apps, descriptor)
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

    getAppSettings: (app: string, {context}: Context = {}) => {
      const params = {context: contextQuery(context)}
      return client(
        routes.Settings(app),
        {params},
      )
    },

    updateAppSettings: (app: string, settings: any, {context}: Context = {}) => {
      const params = {context: contextQuery(context)}
      return client.put(
        routes.Settings(app),
        settings,
        {params},
      )
    },

    patchAppSettings: (app: string, settings: any, {context}: Context = {}) => {
      const params = {context: contextQuery(context)}
      return client.patch(
        routes.Settings(app),
        settings,
        {params},
      )
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
      return client(routes.File(app, path), {params, transformResponse: noTransforms})
    },

    getApp: (app: string, context: Array<string> = []) => {
      const params = {context: contextQuery(context)}
      return client(routes.App(app), {params})
    },

    getDependencies: (filter: string = '') => {
      const params = {filter}
      return client(routes.Dependencies, {params})
    },
  }
}
