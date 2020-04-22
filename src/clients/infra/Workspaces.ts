import { DEFAULT_WORKSPACE } from '../../constants'
import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

const routes = {
  Account: (account: string) => `/${account}`,
  Promote: (account: string) => `${routes.Workspace(account, DEFAULT_WORKSPACE)}/_promote`,
  Workspace: (account: string, workspace: string) => `${routes.Account(account)}/${workspace}`,
}

export class Workspaces extends InfraClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super('router', context, options, true)
  }

  public list = (account: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'workspaces-list'
    return this.http.get<WorkspaceMetadata[]>(routes.Account(account), {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public get = (account: string, workspace: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'workspaces-get'
    return this.http.get<WorkspaceMetadata>(routes.Workspace(account, workspace), {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public set = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata>, tracingConfig?: RequestTracingConfig) => {
    const metric = 'workspaces-set'
    return this.http.put(routes.Workspace(account, workspace), metadata, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public create = (account: string, workspace: string, production: boolean, tracingConfig?: RequestTracingConfig) => {
    const metric = 'workspaces-create'
    return this.http.post(routes.Account(account), {name: workspace, production}, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public delete = (account: string, workspace: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'workspaces-delete'
    return this.http.delete(routes.Workspace(account, workspace), {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public reset = (account: string, workspace: string, metadata: Partial<WorkspaceMetadata> = {}, tracingConfig?: RequestTracingConfig) => {
    const params = {reset: true}
    const metric = 'workspaces-reset'
    return this.http.put(routes.Workspace(account, workspace), metadata, {metric, params, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }

  public promote = (account: string, workspace: string, tracingConfig?: RequestTracingConfig) => {
    const metric = 'workspaces-promote'
    return this.http.put(routes.Promote(account), {workspace}, {metric, tracing: {
      requestSpanNameSuffix: metric,
      ...tracingConfig?.tracing,
    }})
  }
}

export interface WorkspaceMetadata {
  name: string,
  weight: number,
  production: boolean,
}
