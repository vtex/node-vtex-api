/* @flow */
import Client from './Client'
import {api} from './endpoints'

const routes = {
  Apps: (account: string, workspace: string) =>
    `/${account}/${workspace}/apps`,

  App: (account: string, workspace: string, app: string) =>
    `${this.Apps(account, workspace)}/${app}`,

  Settings: (account: string, workspace: string, app: string) =>
    `${this.App(account, workspace, app)}/settings`,

  Files: (account: string, workspace: string, app: string) =>
    `${this.App(account, workspace, app)}/files`,

  File: (account: string, workspace: string, app: string, path: string) =>
    `${this.Files(account, workspace, app)}/${path}`,

  DependencyMap: (account: string, workspace: string) =>
    `/${account}/${workspace}/dependencyMap`,
}

const contextQuery = (context?: array) => context ? context.join('/') : context

export default class AppsClient extends Client {
  constructor (authToken: string, userAgent: string, endpointUrl: string = 'STABLE') {
    super(authToken, userAgent, api(endpointUrl))
    this.routes = routes
  }

  installApp (account: string, workspace: string, descriptor: string) {
    return this.http.post(this.routes.Apps(account, workspace), descriptor)
  }

  uninstallApp (account: string, workspace: string, app: string) {
    return this.http.delete(this.routes.App(account, workspace, app))
  }

  getAppSettings (account: string, workspace: string, app: string, {context} = {}) {
    const params = {context: contextQuery(context)}
    return this.http(
      this.routes.Settings(account, workspace, app),
      {params},
    )
  }

  updateAppSettings (account: string, workspace: string, app: string, settings: any, {context} = {}) {
    const params = {context: contextQuery(context)}
    return this.http.put(
      this.routes.Settings(account, workspace, app),
      settings,
      {params},
    )
  }

  patchAppSettings (account: string, workspace: string, app: string, settings: any, {context} = {}) {
    const params = {context: contextQuery(context)}
    return this.http.patch(
      this.routes.Settings(account, workspace, app),
      settings,
      {params},
    )
  }

  updateAppTtl (account: string, workspace: string, app: string) {
    return this.http.patch(this.routes.App(account, workspace, app))
  }

  listApps (account: string, workspace: string, {oldVersion, context, since, service}) {
    const params = {
      oldVersion,
      context: contextQuery(context),
      since,
      service,
    }
    return this.http(this.routes.Apps(account, workspace), {params})
  }

  listAppFiles (account: string, workspace: string, app: string, {prefix, context, nextMarker}) {
    const params = {
      prefix,
      context: contextQuery(context),
      marker: encodeURIComponent(nextMarker),
    }
    return this.http(this.routes.Files(account, workspace, app), {params})
  }

  getAppFile (account: string, workspace: string, app: string, path: string, context: array = []) {
    const params = {context: contextQuery(context)}
    return this.http(this.routes.File(account, workspace, app, path), {params})
  }

  getApp (account: string, workspace: string, app: string, context: array = []) {
    const params = {context: contextQuery(context)}
    return this.http(this.routes.App(account, workspace, app), {params})
  }

  getDependencyMap (account: string, workspace: string, service: string) {
    const params = {service}
    return this.http(this.routes.DependencyMap(account, workspace), {params})
  }
}
