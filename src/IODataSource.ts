import { DataSource, DataSourceConfig } from 'apollo-datasource'
import { HttpClient, InstanceOptions } from './HttpClient'
import { IOContext, ServiceContext } from './service/typings'

interface HttpClientFactoryOptions {
  service: string | void
  context: IOContext | void
  options: InstanceOptions | void
}

export type HttpClientFactory = (opts: HttpClientFactoryOptions) => HttpClient | void

/**
 * @deprecated Extend one of the subclasses of IOClient instead.
 */
export abstract class IODataSource extends DataSource<ServiceContext> {
  protected abstract httpClientFactory: HttpClientFactory
  protected service: string | void = undefined
  private httpClient: HttpClient | void = undefined
  private initialized = false

  constructor(protected context?: IOContext, private options: InstanceOptions = {}) {
    super()
  }

  public initialize(config: DataSourceConfig<ServiceContext>) {
    const {
      context: { vtex: context },
      cache: cacheStorage,
    } = config
    this.context = context
    this.httpClient = this.httpClientFactory({
      context,
      options: { cacheStorage, ...this.options } as any,
      service: this.service,
    })
    this.initialized = true
  }

  get http(): HttpClient {
    if (!this.initialized) {
      this.initialize({ context: { vtex: this.context } } as any)
    }
    if (this.httpClient) {
      return this.httpClient
    }
    throw new Error('IO Datasource was not initialized nor constructed with a context')
  }
}

export const forWorkspace: HttpClientFactory = ({ context, service, options }) =>
  context && service ? HttpClient.forWorkspace(service, context, options || {}) : undefined

export const forRoot: HttpClientFactory = ({ context, service, options }) =>
  context && service ? HttpClient.forRoot(service, context, options || {}) : undefined

export const forExternal: HttpClientFactory = ({ context, service, options }) =>
  context && service ? HttpClient.forExternal(service, context, options || ({} as any)) : undefined
