import {DEFAULT_WORKSPACE} from '../constants'
import {forRoot, IODataSource} from '../IODataSource'

const routes = {
  Account: (account: string) => `/${account}`,
  Promote: (account: string) => `${routes.Workspace(account, DEFAULT_WORKSPACE)}/_promote`,
  Workspace: (account: string, workspace: string) => `${routes.Account(account)}/${workspace}`,
}

export class Workspaces extends IODataSource {
  protected service = 'router'
  protected httpClientFactory = forRoot

  public list = (account: string) => {
    return this.http.get<WorkspaceMetadata[]>(routes.Account(account), {metric: 'workspaces-list'})
  }

  public get = (account: string, workspace: string) => {
    return this.http.get<WorkspaceMetadata>(routes.Workspace(account, workspace), {metric: 'workspaces-get'})
  }

  public set = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata>) => {
    return this.http.put(routes.Workspace(account, workspace), metadata, {metric: 'workspaces-set'})
  }

  public create = (account: string, workspace: string, production: boolean) => {
    return this.http.post(routes.Account(account), {name: workspace, production}, {metric: 'workspaces-create'})
  }

  public delete = (account: string, workspace: string) => {
    return this.http.delete(routes.Workspace(account, workspace), {metric: 'workspaces-delete'})
  }

  public reset = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata> = {}) => {
    const params = {reset: true}
    const metric = 'workspaces-reset'
    return this.http.put(routes.Workspace(account, workspace), metadata, {params, metric})
  }

  public promote = (account: string, workspace: string) => {
    return this.http.put(routes.Promote(account), {workspace}, {metric: 'workspaces-promote'})
  }
}

export interface WorkspaceMetadata {
  name: string,
  weight: number,
  production: boolean,
}
