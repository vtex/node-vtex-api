/* @flow */
import {createClient, createRootURL} from './baseClient'
import type {InstanceOptions} from './baseClient'
import {DefaultWorkspace} from './Workspaces'

const routes = {
  AvailableServices: '/_services',

  AvailableVersions: (name: string) =>
    `${routes.AvailableServices}/${name}`,

  InstalledServices: (account: string, workspace: string) =>
    `/${account}/${workspace}/services`,

  InstalledService: (account: string, workspace: string, name: string) =>
    `/${routes.InstalledServices(account, workspace)}/services/${name}`,
}

export type RouterInstance = {
  listAvailableServices: () => any,
  getAvailableVersions: (name: string) => any,
  listInstalledServices: () => any,
  installService: (name: string, version: string) => any,
}

export default function Router (opts: InstanceOptions): RouterInstance {
  const {account, workspace} = opts
  const client = createClient({
    ...opts,
    baseURL: createRootURL('kube-router', {...opts, workspace: DefaultWorkspace}),
  })

  return {
    listAvailableServices: () => {
      return client.get(routes.AvailableServices)
    },

    getAvailableVersions: (name: string) => {
      return client.get(routes.AvailableVersions(name))
    },

    listInstalledServices: () => {
      if (!account || !workspace) {
        throw new Error('Missing client parameters: {account, workspace}')
      }
      return client.get(routes.InstalledServices(account, workspace))
    },

    installService: (name: string, version: string) => {
      if (!account || !workspace) {
        throw new Error('Missing client parameters: {account, workspace}')
      }
      return client.post(routes.InstalledServices(account, workspace), {name, version})
    },
  }
}
