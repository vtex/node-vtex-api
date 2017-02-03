/* @flow */
import Client from './Client'
import {workspaces} from './endpoints'
import type {ClientOptions} from './Client'

const CURRENT_MAJOR_VND = 'application/vnd.vtex.vbase.v1+json'
const DEFAULT_WORKSPACE = 'master'

const routes = {
  Account: (account: string) =>
    `/${account}`,

  Workspace: (account: string, workspace: string) =>
    `${routes.Account(account)}/${workspace}`,

  DefaultWorkspace: (account: string) =>
    `${routes.Workspace(account, DEFAULT_WORKSPACE)}`,
}

export default class WorkspacesClient extends Client {
  constructor (endpointUrl: string = 'STABLE', {authToken, userAgent, accept = CURRENT_MAJOR_VND, timeout}: ClientOptions = {}) {
    super(workspaces(endpointUrl), {authToken, userAgent, accept, timeout})
  }

  list (account: string) {
    return this.http(routes.Account(account))
  }

  get (account: string, workspace: string) {
    return this.http(routes.Workspace(account, workspace))
  }

  create (account: string, workspace: string) {
    return this.http.post(routes.Account(account), {name: workspace})
  }

  delete (account: string, workspace: string) {
    return this.http.delete(routes.Workspace(account, workspace))
  }

  promote (account: string, workspace: string) {
    return this.http.put(routes.DefaultWorkspace(account, workspace), {workspace})
  }
}
