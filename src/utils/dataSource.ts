import {DataSource, DataSourceConfig} from 'apollo-datasource'
import {HttpClient, InstanceOptions, IOContext, LegacyInstanceOptions, ServiceContext} from '../HttpClient'

interface HttpClientFactoryOptions {
  service?: string
  context?: IOContext
  options?: InstanceOptions | LegacyInstanceOptions
}

export type HttpClientFactory = (opts: HttpClientFactoryOptions) => HttpClient | void

export class IODataSource extends DataSource<ServiceContext> {
  private httpClient: HttpClient | void

  constructor (
    private httpClientFactory: HttpClientFactory,
    private opts: HttpClientFactoryOptions = {}
  ) {
    super()
    this.httpClient = httpClientFactory(opts)
  }

  public initialize(config: DataSourceConfig<ServiceContext>) {
    const {context: {vtex: context}, cache: cacheStorage} = config
    this.httpClient = this.httpClientFactory({
      context,
      options: {cacheStorage, ...this.opts.options} as any,
      service: this.opts.service,
    })
  }

  get http(): HttpClient {
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
