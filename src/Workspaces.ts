import {DEFAULT_WORKSPACE} from './constants'
import {HttpClient, InstanceOptions, IOContext} from './HttpClient'

const routes = {
  Account: (account: string) => `/${account}`,
  Promote: (account: string) => `${routes.Workspace(account, DEFAULT_WORKSPACE)}/_promote`,
  Workspace: (account: string, workspace: string) => `${routes.Account(account)}/${workspace}`,
}

export class Workspaces {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.http = HttpClient.forRoot('router', ioContext, opts)
  }

  public list = (account: string) => {
    return this.http.get<WorkspaceMetadata[]>(routes.Account(account))
  }

  public get = (account: string, workspace: string) => {
    return this.http.get<WorkspaceMetadata>(routes.Workspace(account, workspace))
  }

  public set = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata>) => {
    return this.http.put(routes.Workspace(account, workspace), metadata)
  }

  public create = (account: string, workspace: string) => {
    return this.http.post(routes.Account(account), {name: workspace})
  }

  public delete = (account: string, workspace: string) => {
    return this.http.delete(routes.Workspace(account, workspace))
  }

  public reset = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata> = {}) => {
    const params = {reset: true}
    return this.http.put(routes.Workspace(account, workspace), metadata, {params})
  }

  public promote = (account: string, workspace: string) => {
    return this.http.put(routes.Promote(account), {workspace})
  }
}

export interface WorkspaceMetadata {
  name: string,
  weight: number,
  production: boolean,
}
