/* @flow */
import {createClient, createRootURL} from './baseClient'
import type {InstanceOptions} from './baseClient'

export const DefaultWorkspace = 'master'

type WorkspaceMetadata = {
  production: boolean,
  weight: ?number,
}

const routes = {
  Account: (account: string) =>
    `/${account}`,

  Workspace: (account: string, workspace: string) =>
    `${routes.Account(account)}/${workspace}`,

  Promote: (account: string) =>
    `${routes.Workspace(account, DefaultWorkspace)}/_promote`,
}

export type WorkspacesInstance = {
  list: (account: string) => any,
  get: (account: string, workspace: string) => any,
  create: (account: string, workspace: string) => any,
  delete: (account: string, workspace: string) => any,
  promote: (account: string, workspace: string) => any,
}

export default function Workspaces (opts: InstanceOptions): WorkspacesInstance {
  const client = createClient({...opts, baseURL: createRootURL('kube-router', opts)})

  return {
    list: (account: string) => {
      return client(routes.Account(account))
    },

    get: (account: string, workspace: string) => {
      return client(routes.Workspace(account, workspace))
    },

    set: (account: string, workspace: string, metadata: WorkspaceMetadata) => {
      return client.put(routes.Workspace(account, workspace), metadata)
    },

    create: (account: string, workspace: string) => {
      return client.post(routes.Account(account), {name: workspace})
    },

    delete: (account: string, workspace: string) => {
      return client.delete(routes.Workspace(account, workspace))
    },

    promote: (account: string, workspace: string) => {
      return client.put(routes.Promote(account), {workspace})
    },
  }
}
