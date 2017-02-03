/* @flow */
import {createClient, createRootURL} from './client'
import type {InstanceOptions} from './client'

export const DefaultWorkspace = 'master'

const routes = {
  Account: (account: string) =>
    `/${account}`,

  Workspace: (account: string, workspace: string) =>
    `${routes.Account(account)}/${workspace}`,

  DefaultWorkspace: (account: string) =>
    `${routes.Workspace(account, DefaultWorkspace)}`,
}

export type WorkspacesInstance = {
  list: (account: string) => any,
  get: (account: string, workspace: string) => any,
  create: (account: string, workspace: string) => any,
  delete: (account: string, workspace: string) => any,
  promote: (account: string, workspace: string) => any,
}

export default function Workspaces (opts: InstanceOptions): WorkspacesInstance {
  const client = createClient({...opts, baseURL: createRootURL('apps', opts)})

  return {
    list: (account: string) => {
      return client(routes.Account(account))
    },

    get: (account: string, workspace: string) => {
      return client(routes.Workspace(account, workspace))
    },

    create: (account: string, workspace: string) => {
      return client.post(routes.Account(account), {name: workspace})
    },

    delete: (account: string, workspace: string) => {
      return client.delete(routes.Workspace(account, workspace))
    },

    promote: (account: string, workspace: string) => {
      return client.put(routes.DefaultWorkspace(account, workspace), {workspace})
    },
  }
}
