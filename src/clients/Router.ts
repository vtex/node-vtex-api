import { HttpClient, InstanceOptions } from '../HttpClient'
import { forRoot, IOClient } from '../IOClient'
import { IOContext } from '../service/typings'

const routes = {
  AvailableIoVersions: '/_io',
  AvailableServiceVersions: (service: string) => `${routes.AvailableServices}/${service}`,
  AvailableServices: '/_services',
  InstalledIoVersion: (account: string, workspace: string) => `/${account}/${workspace}/io`,
  InstalledService: (account: string, workspace: string, name: string) => `/${routes.InstalledServices(account, workspace)}/services/${name}`,
  InstalledServices: (account: string, workspace: string) => `/${account}/${workspace}/services`,
}

export class Router extends IOClient {
  protected httpClientFactory = forRoot
  protected service = 'router'

  public listAvailableIoVersions = () => {
    return this.http.get<AvaiableIO[]>(routes.AvailableIoVersions)
  }

  public getInstalledIoVersion = () => {
    const { account, workspace } = this.context
    if (!account || !workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledIO>(routes.InstalledIoVersion(this.context.account, workspace))
  }

  public installIo = (version: string) => {
    const { account, workspace } = this.context
    if (!account || !workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.put(routes.InstalledIoVersion(account, workspace), {version})
  }

  public listAvailableServices = () => {
    return this.http.get<AvailableServices>(routes.AvailableServices)
  }

  public getAvailableVersions = (name: string) => {
    return this.http.get<AvailableServiceVersions>(routes.AvailableServiceVersions(name))
  }

  public listInstalledServices = () => {
    const { account, workspace } = this.context
    if (!account || !workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledService[]>(routes.InstalledServices(account, workspace))
  }

  public installService = (name: string, version: string) => {
    const { account, workspace } = this.context
    if (!account || !workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.post(routes.InstalledServices(account, workspace), {name, version})
  }
}

export interface AvaiableIO {
  version: string,
  tested: boolean,
  services: {
    [service: string]: string,
  },
}

export type InstalledIO = AvaiableIO

export interface AvailableServiceVersions {
  versions: {
    [region: string]: string[],
  },
}

export interface AvailableServices {
  [service: string]: AvailableServiceVersions,
}

export interface InstalledService {
  name: string,
  version: string,
  serviceIsolation: number,
}
