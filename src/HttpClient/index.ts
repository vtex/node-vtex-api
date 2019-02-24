import {AxiosRequestConfig, AxiosResponse} from 'axios'
import * as compose from 'koa-compose'
import {IncomingMessage} from 'http'

import {MiddlewareContext} from './context'
import {cacheMiddleware, CacheableRequestConfig, CacheStorage} from './middlewares/cache'
import {Recorder, recorderMiddleware} from './middlewares/recorder'
import {notFoundFallbackMiddleware, acceptNotFoundMiddleware} from './middlewares/notFound'
import {defaultsMiddleware, requestMiddleware} from './middlewares/request'

const DEFAULT_TIMEOUT_MS = 10000
const noTransforms = [(data: any) => data]

const rootURL = (service: string, {region}: IOContext, {endpoint}: InstanceOptions): string => {
  if (endpoint) {
    return 'http://' + endpoint
  }

  if (region) {
    return `http://${service}.${region}.vtex.io`
  }

  throw new Error('Missing required: should specify either {region} or {endpoint}')
}

const workspaceURL = (service: string, context: IOContext, opts: InstanceOptions): string => {
  const {account, workspace} = context
  if (!account || !workspace) {
    throw new Error('Missing required arguments: {account, workspace}')
  }

  return rootURL(service, context, opts) + `/${account}/${workspace}`
}

export class HttpClient {
  private runMiddlewares: compose.ComposedMiddleware<MiddlewareContext>

  private constructor (opts: ClientOptions) {
    const {baseURL, authToken, authType, cacheStorage, recorder, userAgent, timeout = DEFAULT_TIMEOUT_MS} = opts
    const headers = {
      'Accept-Encoding': 'gzip',
      Authorization: `${authType} ${authToken}`,
      'User-Agent': userAgent,
    }

    this.runMiddlewares = compose([
      defaultsMiddleware(baseURL, headers, timeout),
      ...recorder ? [recorderMiddleware(recorder)] : [],
      acceptNotFoundMiddleware,
      ...cacheStorage ? [cacheMiddleware(cacheStorage)] : [],
      notFoundFallbackMiddleware,
      requestMiddleware,
    ])
  }

  static forWorkspace (service: string, context: IOContext, opts: InstanceOptions): HttpClient {
    const {authToken, userAgent, recorder} = context
    const {timeout, cacheStorage} = opts
    const baseURL = workspaceURL(service, context, opts)
    return new HttpClient({baseURL, authType: AuthType.bearer, authToken, userAgent, timeout, recorder, cacheStorage})
  }

  static forRoot (service: string, context: IOContext, opts: InstanceOptions): HttpClient {
    const {authToken, userAgent, recorder} = context
    const {timeout, cacheStorage} = opts
    const baseURL = rootURL(service, context, opts)
    return new HttpClient({baseURL, authType: AuthType.bearer, authToken, userAgent, timeout, recorder, cacheStorage})
  }

  static forLegacy (endpoint: string, opts: LegacyInstanceOptions): HttpClient {
    const {authToken, userAgent, timeout, cacheStorage} = opts
    return new HttpClient({baseURL: endpoint, authType: AuthType.token, authToken, userAgent, timeout, cacheStorage})
  }

  private request = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    const context: MiddlewareContext = {config}
    await this.runMiddlewares(context)
    return context.response!
  }

  get = <T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> => {
    const cacheableConfig = {...config, url, cacheable: true} as CacheableRequestConfig
    return this.request(cacheableConfig).then(response => response.data as T)
  }

  getRaw = <T = any>(url: string, config: AxiosRequestConfig = {}): Promise<IOResponse<T>> => {
    const cacheableConfig = {...config, url, cacheable: true} as CacheableRequestConfig
    return this.request(cacheableConfig) as Promise<IOResponse<T>>
  }

  getBuffer = (url: string, config: AxiosRequestConfig = {}): Promise<{data: Buffer, headers: any}> => {
    const bufferConfig = {...config, url, responseType: 'arraybuffer', transformResponse: noTransforms}
    return this.request(bufferConfig)
  }

  getStream = (url: string, config: AxiosRequestConfig = {}): Promise<IncomingMessage> => {
    const streamConfig = {...config, url, responseType: 'stream', transformResponse: noTransforms}
    return this.request(streamConfig).then(response => response.data as IncomingMessage)
  }

  put = <T = void>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<T> => {
    const putConfig: AxiosRequestConfig = {...config, url, data, method: 'put'}
    return this.request(putConfig).then(response => response.data as T)
  }

  post = <T = void>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<T> => {
    console.error(`POST request to ${url}`)
    const postConfig: AxiosRequestConfig = {...config, url, data, method: 'post'}
    return this.request(postConfig).then(response => response.data as T)
  }

  postRaw = <T = void>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<IOResponse<T>> => {
    const postConfig: AxiosRequestConfig = {...config, url, data, method: 'post'}
    return this.request(postConfig) as Promise<IOResponse<T>>
  }

  patch = <T = void>(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<T> => {
    const patchConfig: AxiosRequestConfig = {...config, url, data, method: 'patch'}
    return this.request(patchConfig).then(response => response.data as T)
  }

  delete = (url: string, config?: AxiosRequestConfig): Promise<void> => {
    const deleteConfig: AxiosRequestConfig = {...config, url, method: 'delete'}
    return this.request(deleteConfig).then(() => {})
  }
}

export const withoutRecorder = (ioContext: IOContext): IOContext => {
  return {...ioContext, recorder: undefined}
}

export type CacheStorage = CacheStorage

export type Recorder = Recorder

export type IOContext = {
  authToken: string,
  userAgent: string,
  account: string,
  workspace: string,
  recorder?: Recorder,
  region: string,
  production: boolean,
}

export type InstanceOptions = {
  timeout?: number,
  cacheStorage?: CacheStorage,
  endpoint?: string,
}

export type LegacyInstanceOptions = {
  authToken: string,
  userAgent: string,
  timeout?: number,
  accept?: string,
  cacheStorage?: CacheStorage,
}

export interface IOResponse<T> {
  data: T
  headers: any
  status: number
}

enum AuthType {
  bearer = 'bearer',
  token = 'token',
}

type ClientOptions = {
  authType: AuthType,
  authToken: string,
  userAgent: string
  baseURL: string,
  timeout?: number,
  recorder?: Recorder,
  cacheStorage?: CacheStorage,
}
