import {DataSource, DataSourceConfig} from 'apollo-datasource'
import {HttpClient, InstanceOptions, IOContext, LegacyInstanceOptions, ServiceContext} from './HttpClient'

interface HttpClientFactoryOptions {
  service: string | void
  context: IOContext | void
  options: InstanceOptions | LegacyInstanceOptions | void
}

export type HttpClientFactory = (opts: HttpClientFactoryOptions) => HttpClient | void

export abstract class IODataSource extends DataSource<ServiceContext> {
  protected abstract httpClientFactory: HttpClientFactory
  protected service: string | void = undefined
  private httpClient: HttpClient | void = undefined
  private initialized = false

  constructor (
    protected context?: IOContext,
    private options: InstanceOptions = {},
  ) {
    super()
  }

  public initialize(config: DataSourceConfig<ServiceContext>) {
    const {context: {vtex: context}, cache: cacheStorage} = config
    this.context = context
    this.httpClient = this.httpClientFactory({
      context,
      options: {cacheStorage, ...this.options} as any,
      service: this.service,
    })
    this.initialized = true
  }

  get http(): HttpClient {
    if (!this.initialized) {
      this.initialize({context: {vtex: this.context}} as any)
    }
    if (this.httpClient) {
      return this.httpClient
    }
    throw new Error('IO Datasource was not initialized nor constructed with a context')
  }
}

export const forWorkspace: HttpClientFactory = ({context, service, options}) => (context && service)
  ? HttpClient.forWorkspace(service, context, options || {})
  : undefined

export const forRoot: HttpClientFactory = ({context, service, options}) => (context && service)
  ? HttpClient.forRoot(service, context, options || {})
  : undefined

export const forLegacy: HttpClientFactory = ({service, options}) => service
  ? HttpClient.forLegacy(service, options || {} as any)
  : undefined
