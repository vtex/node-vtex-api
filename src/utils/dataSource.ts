import {DataSource, DataSourceConfig} from 'apollo-datasource'
import {HttpClient, InstanceOptions, IOContext, LegacyInstanceOptions, ServiceContext} from '../HttpClient'

export interface IODataSourceOptions {
  service?: string
  context?: IOContext
  options?: InstanceOptions | LegacyInstanceOptions
}

type HttpClientFactory = (options: IODataSourceOptions) => HttpClient | void

export class IODataSource extends DataSource<ServiceContext> {
  private httpClient: HttpClient | void

  constructor (
    private httpClientFactory: (opts: IODataSourceOptions) => HttpClient | void,
    private options: IODataSourceOptions
  ) {
    super()
    this.httpClient = httpClientFactory(options)
  }

  public initialize(config: DataSourceConfig<ServiceContext>) {
    const {context: {vtex}, cache} = config
    this.httpClient = this.httpClientFactory({
      context: vtex,
      options: {cacheStorage: cache as any, ...this.options && this.options.options},
      service: this.options && this.options.service,
    })
  }

  get http(): HttpClient {
    if (this.httpClient) {
      return this.httpClient
    }
    throw new Error('IO Datasource was not initialized nor constructed with a context')
  }
}

export const workspaceClientFactory: HttpClientFactory = ({service, context, options}) => (service && context)
  ? HttpClient.forWorkspace(service, context, options || {})
  : undefined

export const legacyClientFactory: HttpClientFactory = ({service, options}) => service
  ? HttpClient.forLegacy(service, options || {} as any)
  : undefined

export const rootClientFactory: HttpClientFactory = ({service, context, options}) => (service && context)
  ? HttpClient.forRoot(service, context, options || {})
  : undefined
