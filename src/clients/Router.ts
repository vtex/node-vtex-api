import {HttpClient, InstanceOptions} from '../HttpClient'
import {IOContext} from '../service/typings'

const routes = {
  AvailableIoVersions: '/_io',
  AvailableServiceVersions: (service: string) => `${routes.AvailableServices}/${service}`,
  AvailableServices: '/_services',
  InstalledIoVersion: (account: string, workspace: string) => `/${account}/${workspace}/io`,
  InstalledService: (account: string, workspace: string, name: string) => `/${routes.InstalledServices(account, workspace)}/services/${name}`,
  InstalledServices: (account: string, workspace: string) => `/${account}/${workspace}/services`,
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

  public listAvailableIoVersions = () => {
    return this.http.get<AvaiableIO[]>(routes.AvailableIoVersions)
  }

  public getInstalledIoVersion = () => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledIO>(routes.InstalledIoVersion(this.account, this.workspace))
  }

  public installIo = (version: string) => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.put(routes.InstalledIoVersion(this.account, this.workspace), {version})
  }

  public listAvailableServices = () => {
    return this.http.get<AvailableServices>(routes.AvailableServices)
  }

  public getAvailableVersions = (name: string) => {
    return this.http.get<AvailableServiceVersions>(routes.AvailableServiceVersions(name))
  }

  public listInstalledServices = () => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledService[]>(routes.InstalledServices(this.account, this.workspace))
  }

  public installService = (name: string, version: string) => {
    if (!this.account || !this.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.post(routes.InstalledServices(this.account, this.workspace), {name, version})
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
