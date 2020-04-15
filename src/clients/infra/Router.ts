import { InstanceOptions, RequestTracingConfig } from '../../HttpClient'
import { IOContext } from '../../service/worker/runtime/typings'
import { InfraClient } from './InfraClient'

const routes = {
  AvailableIoVersions: '/_io',
  AvailableServiceVersions: (service: string) => `${routes.AvailableServices}/${service}`,
  AvailableServices: '/_services',
  InstalledIoVersion: (account: string, workspace: string) => `/${account}/${workspace}/io`,
  InstalledService: (account: string, workspace: string, name: string) => `/${routes.InstalledServices(account, workspace)}/services/${name}`,
  InstalledServices: (account: string, workspace: string) => `/${account}/${workspace}/services`,
}

export class Router extends InfraClient {
  constructor (ioContext: IOContext, opts?: InstanceOptions) {
    super('router', ioContext, opts, true)
  }

  public listAvailableIoVersions = (tracingConfig?: RequestTracingConfig) => {
    return this.http.get<AvaiableIO[]>(routes.AvailableIoVersions, { tracing: {
      requestSpanNameSuffix: 'list-io-versions',
      ...tracingConfig?.tracing,
    }})
  }

  public getInstalledIoVersion = (tracingConfig?: RequestTracingConfig) => {
    if (!this.context.account || !this.context.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledIO>(routes.InstalledIoVersion(this.context.account, this.context.workspace), {
      tracing: {
        requestSpanNameSuffix: 'get-installed-io-version',
        ...tracingConfig?.tracing,
      },
    })
  }

  public installIo = (version: string, tracingConfig?: RequestTracingConfig) => {
    if (!this.context.account || !this.context.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.put(routes.InstalledIoVersion(this.context.account, this.context.workspace), {version}, { tracing: {
      requestSpanNameSuffix: 'install-io',
      ...tracingConfig?.tracing,
    }})
  }

  public listAvailableServices = (tracingConfig?: RequestTracingConfig) => {
    return this.http.get<AvailableServices>(routes.AvailableServices, {
      tracing: {
        requestSpanNameSuffix: 'list-available-services',
        ...tracingConfig?.tracing,
      },
    })
  }

  public getAvailableVersions = (name: string, tracingConfig?: RequestTracingConfig) => {
    return this.http.get<AvailableServiceVersions>(routes.AvailableServiceVersions(name), {
      tracing: {
        requestSpanNameSuffix: 'get-versions',
        ...tracingConfig?.tracing,
      },
    })
  }

  public listInstalledServices = (tracingConfig?: RequestTracingConfig) => {
    if (!this.context.account || !this.context.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.get<InstalledService[]>(routes.InstalledServices(this.context.account, this.context.workspace), {
      tracing: {
        requestSpanNameSuffix: 'list-installed-services',
        ...tracingConfig?.tracing,
      },
    })
  }

  public installService = (name: string, version: string, tracingConfig?: RequestTracingConfig) => {
    if (!this.context.account || !this.context.workspace) {
      throw new Error('Missing client parameters: {account, workspace}')
    }
    return this.http.post(routes.InstalledServices(this.context.account, this.context.workspace), {name, version}, {
      tracing: {
        requestSpanNameSuffix: 'install-service',
        ...tracingConfig?.tracing,
      },
    })
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
