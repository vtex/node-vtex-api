import { AxiosResponse } from 'axios'
import { IAxiosRetryConfig } from 'axios-retry'
import { IncomingMessage } from 'http'
import compose from 'koa-compose'
import pLimit from 'p-limit'

import { CacheLayer } from '../caches/CacheLayer'
import { MetricsAccumulator } from '../metrics/MetricsAccumulator'

import { IOContext } from '../service/typings'
import { MiddlewareContext, RequestConfig } from './context'
import { CacheableRequestConfig, Cached, cacheMiddleware, CacheType } from './middlewares/cache'
import { memoizationMiddleware, Memoized } from './middlewares/memoization'
import { metricsMiddleware } from './middlewares/metrics'
import { acceptNotFoundMiddleware, notFoundFallbackMiddleware } from './middlewares/notFound'
import { Recorder, recorderMiddleware } from './middlewares/recorder'
import { defaultsMiddleware, requestMiddleware } from './middlewares/request'

const DEFAULT_TIMEOUT_MS = 3 * 1000
const noTransforms = [(data: any) => data]

const rootURL = (service: string, {region}: IOContext, {baseURL}: InstanceOptions): string => {
  if (baseURL) {
    return 'http://' + baseURL
  }

  if (region) {
    return `http://${service}.${region}.vtex.io`
  }

  throw new Error('Missing required: should specify either {region} or {baseURL}')
}

const workspaceURL = (service: string, context: IOContext, opts: InstanceOptions): string => {
  const {account, workspace} = context
  if (!account || !workspace) {
    throw new Error('Missing required arguments: {account, workspace}')
  }

  return rootURL(service, context, opts) + `/${account}/${workspace}`
}

export class HttpClient {

  public static forWorkspace (service: string, context: IOContext, opts: InstanceOptions): HttpClient {
    const baseURL = workspaceURL(service, context, opts)
    return new HttpClient({
      ...context,
      ...opts,
      authType: AuthType.bearer,
      baseURL,
    })
  }

  public static forRoot (service: string, context: IOContext, opts: InstanceOptions): HttpClient {
    const baseURL = rootURL(service, context, opts)
    return new HttpClient({
      ...context,
      ...opts,
      authType: AuthType.bearer,
      baseURL,
    })
  }

  public static forExternal (baseURL: string, context: IOContext, opts: InstanceOptions): HttpClient {
    return new HttpClient({
      ...context,
      ...opts,
      baseURL,
    })
  }

  private runMiddlewares: compose.ComposedMiddleware<MiddlewareContext>

  public constructor (opts: ClientOptions) {
    const {baseURL, authToken, authType, memoryCache, diskCache, metrics, recorder, userAgent, timeout = DEFAULT_TIMEOUT_MS, segmentToken, retryConfig, concurrency, headers: defaultHeaders, operationId} = opts
    const limit = concurrency && concurrency > 0 && pLimit(concurrency) || undefined
    const headers: Record<string, string> = {
      ...defaultHeaders,
      'Accept-Encoding': 'gzip',
      'User-Agent': userAgent,
      'x-vtex-operation-id': operationId,
      ... segmentToken ? {'x-vtex-segment': segmentToken} : null,
    }

    if (authType && authToken) {
      headers['Authorization'] = `${authType} ${authToken}` // tslint:disable-line
    }

    const memoizedCache = new Map<string, Promise<Memoized>>()

    this.runMiddlewares = compose([
      defaultsMiddleware(baseURL, headers, timeout, retryConfig),
      ...metrics ? [metricsMiddleware(metrics)] : [],
      memoizationMiddleware({memoizedCache}),
      ...recorder ? [recorderMiddleware(recorder)] : [],
      acceptNotFoundMiddleware,
      ...memoryCache ? [cacheMiddleware({type: CacheType.Memory, storage: memoryCache, segmentToken: segmentToken || ''})] : [],
      ...diskCache ? [cacheMiddleware({type: CacheType.Disk, storage: diskCache, segmentToken: segmentToken || ''})] : [],
      notFoundFallbackMiddleware,
      requestMiddleware(limit),
    ])
  }

  public get = <T = any>(url: string, config: RequestConfig = {}): Promise<T> => {
    const cacheableConfig = {memoizable: true, cacheable: CacheType.Memory, ...config, url} as CacheableRequestConfig
    return this.request(cacheableConfig).then(response => response.data as T)
  }

  public getRaw = <T = any>(url: string, config: RequestConfig = {}): Promise<IOResponse<T>> => {
    const cacheableConfig = {memoizable: true, cacheable: CacheType.Memory, ...config, url} as CacheableRequestConfig
    return this.request(cacheableConfig) as Promise<IOResponse<T>>
  }

  public getBuffer = (url: string, config: RequestConfig = {}): Promise<{data: Buffer, headers: any}> => {
    const bufferConfig = {cacheable: CacheType.Disk, ...config, url, responseType: 'arraybuffer', transformResponse: noTransforms}
    return this.request(bufferConfig)
  }

  public getStream = (url: string, config: RequestConfig = {}): Promise<IncomingMessage> => {
    const streamConfig = {...config, url, responseType: 'stream', transformResponse: noTransforms}
    return this.request(streamConfig).then(response => response.data as IncomingMessage)
  }

  public put = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<T> => {
    const putConfig: RequestConfig = {...config, url, data, method: 'put'}
    return this.request(putConfig).then(response => response.data as T)
  }

  public post = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<T> => {
    const postConfig: RequestConfig = {...config, url, data, method: 'post'}
    return this.request(postConfig).then(response => response.data as T)
  }

  public postRaw = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<IOResponse<T>> => {
    const postConfig: RequestConfig = {...config, url, data, method: 'post'}
    return this.request(postConfig) as Promise<IOResponse<T>>
  }

  public patch = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<T> => {
    const patchConfig: RequestConfig = {...config, url, data, method: 'patch'}
    return this.request(patchConfig).then(response => response.data as T)
  }

  public delete = (url: string, config?: RequestConfig): Promise<IOResponse<void>> => {
    const deleteConfig: RequestConfig = {...config, url, method: 'delete'}
    return this.request(deleteConfig)
  }

  private request = async (config: RequestConfig): Promise<AxiosResponse> => {
    const context: MiddlewareContext = {config}
    await this.runMiddlewares(context)
    return context.response!
  }
}

export const withoutRecorder = (ioContext: IOContext): IOContext => {
  return {...ioContext, recorder: undefined}
}

export type CacheStorage = CacheLayer<string, Cached>

export type Recorder = Recorder

export interface InstanceOptions {
  authType?: AuthType
  timeout?: number,
  memoryCache?: CacheLayer<string, Cached>,
  diskCache?: CacheLayer<string, Cached>,
  baseURL?: string,
  retryConfig?: IAxiosRetryConfig,
  metrics?: MetricsAccumulator,
  /**
   * Maximum number of concurrent requests
   *
   * @type {number}
   * @memberof InstanceOptions
   */
  concurrency?: number,
  /**
   * Default headers to be sent with every request
   *
   * @type {Record<string, string>}
   * @memberof InstanceOptions
   */
  headers?: Record<string, string>,
}

export interface IOResponse<T> {
  data: T
  headers: any
  status: number
}

export enum AuthType {
  basic = 'Basic',
  bearer = 'Bearer',
  /**
   * Supported for legacy reasons - this is not spec compliant!
   */
  token = 'token',
}

interface ClientOptions {
  authType?: AuthType
  authToken?: string
  userAgent: string
  baseURL?: string
  timeout?: number
  recorder?: Recorder
  metrics?: MetricsAccumulator
  memoryCache?: CacheLayer<string, Cached>
  diskCache?: CacheLayer<string, Cached>
  segmentToken?: string
  sessionToken?: string
  retryConfig?: IAxiosRetryConfig
  concurrency?: number
  headers?: Record<string, string>
  operationId: string
}

export { RequestConfig } from './context'
export { CacheType } from './middlewares/cache'
