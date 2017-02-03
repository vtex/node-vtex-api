/* @flow */
import Client from './Client'
import {apps} from './endpoints'
import type {ClientOptions} from './Client'

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

const data = data => data
const noTransforms = [data]

const routes = {
  Apps: (account: string, workspace: string) =>
    `/${account}/${workspace}/apps`,

  App: (account: string, workspace: string, app: string) =>
    `${routes.Apps(account, workspace)}/${app}`,

  Links: (account: string, workspace: string) =>
    `/${account}/${workspace}/links`,

  Link: (account: string, workspace: string, app: string) =>
    `${routes.Links(account, workspace)}/${app}`,

  Acknowledge: (account: string, workspace: string, app: string, service: string) =>
    `${routes.App(account, workspace, app)}/acknowledge/${service}`,

  Settings: (account: string, workspace: string, app: string) =>
    `${routes.App(account, workspace, app)}/settings`,

  Files: (account: string, workspace: string, app: string) =>
    `${routes.App(account, workspace, app)}/files`,

  File: (account: string, workspace: string, app: string, path: string) =>
    `${routes.Files(account, workspace, app)}/${path}`,

  Dependencies: (account: string, workspace: string) =>
    `/${account}/${workspace}/dependencies`,
}

const contextQuery = (context?: Array<string>) => context ? context.join('/') : context

export default class AppEngineClient extends Client {
  constructor (endpointUrl: string = 'STABLE', {authToken, userAgent, accept = '', timeout}: ClientOptions = {}) {
    super(apps(endpointUrl), {authToken, userAgent, accept, timeout})
  }

  installApp (account: string, workspace: string, descriptor: string) {
    return this.http.post(routes.Apps(account, workspace), descriptor)
  }

  uninstallApp (account: string, workspace: string, app: string) {
    return this.http.delete(routes.App(account, workspace, app))
  }

  acknowledgeApp (account: string, workspace: string, app: string, service: string) {
    return this.http.put(routes.Acknowledge(account, workspace, app, service))
  }

  link (account: string, workspace: string, app: string, changes: Array<Change>) {
    const headers = {
      'Content-Type': 'application/json',
    }
    return this.http.put(routes.Link(account, workspace, app), changes, {headers})
  }

  unlink (account: string, workspace: string, app: string) {
    return this.http.delete(routes.Link(account, workspace, app))
  }

  getAppSettings (account: string, workspace: string, app: string, {context}: Context = {}) {
    const params = {context: contextQuery(context)}
    return this.http(
      routes.Settings(account, workspace, app),
      {params},
    )
  }

  updateAppSettings (account: string, workspace: string, app: string, settings: any, {context}: Context = {}) {
    const params = {context: contextQuery(context)}
    return this.http.put(
      routes.Settings(account, workspace, app),
      settings,
      {params},
    )
  }

  patchAppSettings (account: string, workspace: string, app: string, settings: any, {context}: Context = {}) {
    const params = {context: contextQuery(context)}
    return this.http.patch(
      routes.Settings(account, workspace, app),
      settings,
      {params},
    )
  }

  listApps (account: string, workspace: string, {oldVersion, context, since, service}: ListSettings = {}) {
    const params = {
      oldVersion,
      context: contextQuery(context),
      since,
      service,
    }
    return this.http(routes.Apps(account, workspace), {params})
  }

  listAppFiles (account: string, workspace: string, app: string, {prefix, context, nextMarker}: ListFilesSettings = {}) {
    const params = {
      prefix,
      context: contextQuery(context),
      marker: nextMarker,
    }
    return this.http(routes.Files(account, workspace, app), {params})
  }

  listLinks (account: string, workspace: string) {
    return this.http(routes.Links(account, workspace))
  }

  getAppFile (account: string, workspace: string, app: string, path: string, context: Array<string> = []) {
    const params = {context: contextQuery(context)}
    return this.http(routes.File(account, workspace, app, path), {params, transformResponse: noTransforms})
  }

  getApp (account: string, workspace: string, app: string, context: Array<string> = []) {
    const params = {context: contextQuery(context)}
    return this.http(routes.App(account, workspace, app), {params})
  }

  getDependencies (account: string, workspace: string, filter: string = '') {
    const params = {filter}
    return this.http(routes.Dependencies(account, workspace), {params})
  }
}
