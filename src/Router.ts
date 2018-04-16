import {HttpClient, InstanceOptions, IOContext} from './HttpClient'

const routes = {
  AvailableServices: '/_services',
  AvailableIoVersions: '/_io',
  InstalledIoVersion: (account: string, workspace: string) => `/${account}/${workspace}/io`,
  AvailableServiceVersions: (service: string) => `${routes.AvailableServices}/${service}`,
  InstalledServices: (account: string, workspace: string) => `/${account}/${workspace}/services`,
  InstalledService: (account: string, workspace: string, name: string) => `/${routes.InstalledServices(account, workspace)}/services/${name}`,
}

export class Router {
  private http: HttpClient
  private account: string
  private workspace: string

  constructor (ioContext: IOContext, opts: InstanceOptions = {}) {
    this.account = ioContext.account
    this.workspace = ioContext.workspace
    this.http = HttpClient.forRoot('router', ioContext, opts)
  }

  listAvailableIoVersions = () => {
    return this.http.get<AvaiableIO[]>(routes.AvailableIoVersions)
  }

  getInstalledIoVersion = () => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledIO>(routes.InstalledIoVersion(this.account, this.workspace))
  }

  installIo = (version: string) => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.put(routes.InstalledIoVersion(this.account, this.workspace), {version})
  }

  listAvailableServices = () => {
    return this.http.get<AvailableServices>(routes.AvailableServices)
  }

  getAvailableVersions = (name: string) => {
    return this.http.get<AvailableServiceVersions>(routes.AvailableServiceVersions(name))
  }

  listInstalledServices = () => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledService[]>(routes.InstalledServices(this.account, this.workspace))
  }

  installService = (name: string, version: string) => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.post(routes.InstalledServices(this.account, this.workspace), {name, version})
  }
}

export type AvaiableIO = {
  version: string,
  tested: boolean,
  services: {
    [service: string]: string,
  },
}

export type InstalledIO = AvaiableIO

export type AvailableServiceVersions = {
  versions: {
    [region: string]: string[],
  },
}

export type AvailableServices = {
  [service: string]: AvailableServiceVersions,
}

export type InstalledService = {
  name: string,
  version: string,
  serviceIsolation: number,
}
