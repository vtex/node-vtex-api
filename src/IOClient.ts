import { HttpClient, InstanceOptions } from './HttpClient'
import { IOContext, ServiceContext } from './service/typings'

interface HttpClientFactoryOptions {
  service: string | void
  context: IOContext | void
  options: InstanceOptions | void
}

export type HttpClientFactory = (opts: HttpClientFactoryOptions) => HttpClient | void

export abstract class IOClient {
  protected abstract httpClientFactory: HttpClientFactory
  protected service: string | void = undefined
  private httpClient: HttpClient | void = undefined
  private initialized = false

  constructor ( protected context: IOContext, private options: InstanceOptions = {}
  ) {}

  private initialize() {
    this.httpClient = this.httpClientFactory({
      context: this.context,
      options: this.options,
      service: this.service,
    })
    this.initialized = true
  }

  get http(): HttpClient {
    if (!this.initialized) {
      this.initialize()
    }
    if (this.httpClient) {
      return this.httpClient
    }
    throw new Error('IO Client was not constructed with a context')
  }
}

export const forWorkspace: HttpClientFactory = ({context, service, options}) => (context && service)
  ? HttpClient.forWorkspace(service, context, options || {})
  : undefined

export const forRoot: HttpClientFactory = ({context, service, options}) => (context && service)
  ? HttpClient.forRoot(service, context, options || {})
  : undefined

export const forExternal: HttpClientFactory = ({context, service, options}) => (context && service)
  ? HttpClient.forExternal(service, context, options || {} as any)
  : undefined

