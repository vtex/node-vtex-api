import {AxiosInstance, AxiosRequestConfig} from 'axios'
import {createInstance} from './axios'
import {addCacheInterceptors, CacheableRequestConfig, CacheStorage} from './cache'
import {Recorder, addRecorderInterceptors} from './recorder'
import {IncomingMessage} from 'http'

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
  private http: AxiosInstance

  private constructor (opts: ClientOptions) {
    const {baseURL, authToken, authType, cacheStorage, recorder, userAgent, timeout = DEFAULT_TIMEOUT_MS} = opts
    const headers = {
      Authorization: `${authType} ${authToken}`,
      'User-Agent': userAgent,
    }

    this.http = createInstance(baseURL, headers, timeout)
    if (recorder) {
      addRecorderInterceptors(this.http, recorder)
    }

    if (cacheStorage) {
      addCacheInterceptors(this.http, cacheStorage)
    }
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

  get = <T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> => {
    const cacheableConfig = {...config, cacheable: true} as CacheableRequestConfig
    return this.http.get(url, cacheableConfig).then(response => response.data as T)
  }

  getRaw = <T = any>(url: string, config: AxiosRequestConfig = {}): Promise<IOResponse<T>> => {
    const cacheableConfig = {...config, cacheable: true} as CacheableRequestConfig
    return this.http.get(url, cacheableConfig) as Promise<IOResponse<T>>
  }

  getBuffer = (url: string, config: AxiosRequestConfig = {}): Promise<{data: Buffer, headers: any}> => {
    const bufferConfig = {...config, responseType: 'arraybuffer', transformResponse: noTransforms}
    return this.http.get(url, bufferConfig)
  }

  getStream = (url: string, config: AxiosRequestConfig = {}): Promise<IncomingMessage> => {
    const streamConfig = {...config, responseType: 'stream', transformResponse: noTransforms}
    return this.http.get(url, streamConfig).then(response => response.data as IncomingMessage)
  }

  put = <T = void>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return this.http.put(url, data, config).then(response => response.data as T)
  }

  post = <T = void>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return this.http.post(url, data, config).then(response => response.data as T)
  }

  postRaw = <T = void>(url: string, data?: any, config?: AxiosRequestConfig): Promise<IOResponse<T>> => {
    return this.http.post(url, data, config) as Promise<IOResponse<T>>
  }

  patch = <T = void>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return this.http.patch(url, data, config).then(response => response.data as T)
  }

  delete = (url: string, config?: AxiosRequestConfig): Promise<void> => {
    return this.http.delete(url, config).then(() => {})
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
