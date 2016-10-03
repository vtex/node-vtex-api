/* @flow */
import Client from './Client'
import {api} from './endpoints'

const routes = {
  Apps: (account: string, workspace: string) =>
    `/${account}/${workspace}/apps`,

  App: (account: string, workspace: string, app: string) =>
    `${routes.Apps(account, workspace)}/${app}`,

  Settings: (account: string, workspace: string, app: string) =>
    `${routes.App(account, workspace, app)}/settings`,

  Files: (account: string, workspace: string, app: string) =>
    `${routes.App(account, workspace, app)}/files`,

  File: (account: string, workspace: string, app: string, path: string) =>
    `${routes.Files(account, workspace, app)}/${path}`,

  DependencyMap: (account: string, workspace: string) =>
    `/${account}/${workspace}/dependencyMap`,
}

const contextQuery = (context?: array) => context ? context.join('/') : context

export default class AppsClient extends Client {
  constructor (authToken: string, userAgent: string, endpointUrl: string = 'STABLE') {
    super(authToken, userAgent, api(endpointUrl))
  }

  installApp (account: string, workspace: string, descriptor: string) {
    return this.http.post(routes.Apps(account, workspace), descriptor)
  }

  uninstallApp (account: string, workspace: string, app: string) {
    return this.http.delete(routes.App(account, workspace, app))
  }

  getAppSettings (account: string, workspace: string, app: string, {context} = {}) {
    const params = {context: contextQuery(context)}
    return this.http(
      routes.Settings(account, workspace, app),
      {params},
    )
  }

  updateAppSettings (account: string, workspace: string, app: string, settings: any, {context} = {}) {
    const params = {context: contextQuery(context)}
    return this.http.put(
      routes.Settings(account, workspace, app),
      settings,
      {params},
    )
  }

  patchAppSettings (account: string, workspace: string, app: string, settings: any, {context} = {}) {
    const params = {context: contextQuery(context)}
    return this.http.patch(
      routes.Settings(account, workspace, app),
      settings,
      {params},
    )
  }

  updateAppTtl (account: string, workspace: string, app: string) {
    return this.http.patch(routes.App(account, workspace, app))
  }

  listApps (account: string, workspace: string, {oldVersion, context, since, service}) {
    const params = {
      oldVersion,
      context: contextQuery(context),
      since,
      service,
    }
    return this.http(routes.Apps(account, workspace), {params})
  }

  listAppFiles (account: string, workspace: string, app: string, {prefix, context, nextMarker}) {
    const params = {
      prefix,
      context: contextQuery(context),
      marker: encodeURIComponent(nextMarker),
    }
    return this.http(routes.Files(account, workspace, app), {params})
  }

  getAppFile (account: string, workspace: string, app: string, path: string, context: array = []) {
    const params = {context: contextQuery(context)}
    return this.http(routes.File(account, workspace, app, path), {params})
  }

  getApp (account: string, workspace: string, app: string, context: array = []) {
    const params = {context: contextQuery(context)}
    return this.http(routes.App(account, workspace, app), {params})
  }

  getDependencyMap (account: string, workspace: string, service: string) {
    const params = {service}
    return this.http(routes.DependencyMap(account, workspace), {params})
  }
}
