import {HttpClient, InstanceOptions, IOContext} from './HttpClient'
import {DEFAULT_WORKSPACE} from './constants'

const routes = {
  Account: (account: string) => `/${account}`,
  Workspace: (account: string, workspace: string) => `${routes.Account(account)}/${workspace}`,
  Promote: (account: string) => `${routes.Workspace(account, DEFAULT_WORKSPACE)}/_promote`,
}

export class Workspaces {
  private http: HttpClient

  constructor (ioContext: IOContext, opts: InstanceOptions) {
    this.http = HttpClient.forRoot('router', ioContext, opts)
  }

  list = (account: string) => {
    return this.http.get<WorkspaceMetadata[]>(routes.Account(account))
  }

  get = (account: string, workspace: string) => {
    return this.http.get<WorkspaceMetadata>(routes.Workspace(account, workspace))
  }

  set = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata>) => {
    return this.http.put(routes.Workspace(account, workspace), metadata)
  }

  create = (account: string, workspace: string) => {
    return this.http.post(routes.Account(account), {name: workspace})
  }

  delete = (account: string, workspace: string) => {
    return this.http.delete(routes.Workspace(account, workspace))
  }

  reset = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata> = {}) => {
    const params = {reset: true}
    return this.http.put(routes.Workspace(account, workspace), metadata, {params})
  }

  promote = (account: string, workspace: string) => {
    return this.http.put(routes.Promote(account), {workspace})
  }
}

export type WorkspaceMetadata = {
  name: string,
  weight: number,
  production: boolean,
}
