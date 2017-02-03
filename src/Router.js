/* @flow */
import Client from './Client'
import {router} from './endpoints'
import type {ClientOptions} from './Client'

const routes = {
  AvailableServices: '/_services',

  AvailableVersions: (name) =>
    `${routes.AvailableServices}/${name}`,

  InstalledServices: (account: string, workspace: string) =>
    `/${account}/${workspace}/services`,

  InstalledService: (account: string, workspace: string, name: string) =>
    `/${routes.InstalledServices(account, workspace)}/services/${name}`,
}

export default class RouterClient extends Client {
  constructor (endpointUrl: string = 'STABLE', {authToken, userAgent, accept = '', timeout}: ClientOptions = {}) {
    super(router(endpointUrl), {authToken, userAgent, accept, timeout})
  }

  listAvailableServices () {
    return this.http.get(routes.AvailableServices)
  }

  getAvailableVersions (name: string) {
    return this.http.get(routes.AvailableVersions(name))
  }

  listInstalledServices (account: string, workspace: string) {
    return this.http.get(routes.InstalledServices(account, workspace))
  }

  installService (account: string, workspace: string, name: string, version: string) {
    return this.http.post(routes.InstalledServices(account, workspace), {name, version})
  }
}
