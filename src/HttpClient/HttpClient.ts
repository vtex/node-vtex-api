import { AxiosResponse } from 'axios'
import { IncomingMessage } from 'http'
import compose, { Middleware } from 'koa-compose'
import pLimit from 'p-limit'

import { CacheLayer } from '../caches/CacheLayer'
import { MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { forExternal, forRoot, forWorkspace } from './factories'
import { CacheableRequestConfig, Cached, cacheMiddleware, CacheType } from './middlewares/cache'
import { singleFlightMiddleware } from './middlewares/inflight'
import { memoizationMiddleware, Memoized } from './middlewares/memoization'
import { metricsMiddleware } from './middlewares/metrics'
import { acceptNotFoundMiddleware, notFoundFallbackMiddleware } from './middlewares/notFound'
import { recorderMiddleware } from './middlewares/recorder'
import { defaultsMiddleware, requestMiddleware } from './middlewares/request'
import { AuthType, IOResponse, MiddlewareContext, Recorder, RequestConfig } from './typings'

const DEFAULT_TIMEOUT_MS = 1000
const noTransforms = [(data: any) => data]

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
  retries?: number
  concurrency?: number
  // Default headers to be sent on every request
  headers?: Record<string, string>
  // Default query string parameters to be sent on every request
  params?: Record<string, string>
  middlewares?: Array<Middleware<MiddlewareContext>>
  operationId: string
  verbose?: boolean
}

export class HttpClient {
  public static forWorkspace = forWorkspace
  public static forRoot = forRoot
  public static forExternal = forExternal

  private runMiddlewares: compose.ComposedMiddleware<MiddlewareContext>

  public constructor (opts: ClientOptions) {
    const {baseURL, authToken, authType, memoryCache, diskCache, metrics, recorder, userAgent, timeout = DEFAULT_TIMEOUT_MS, segmentToken, retries, concurrency, headers: defaultHeaders, params, operationId, verbose} = opts
    const limit = concurrency && concurrency > 0 && pLimit(concurrency) || undefined
    const headers: Record<string, string> = {
      ...defaultHeaders,
      'Accept-Encoding': 'gzip',
      'User-Agent': userAgent,
      ... operationId ? {'x-vtex-operation-id': operationId} : null,
      ... segmentToken ? {'x-vtex-segment': segmentToken} : null,
    }

    if (authType && authToken) {
      headers['Authorization'] = `${authType} ${authToken}` // tslint:disable-line
    }

    const memoizedCache = new Map<string, Promise<Memoized>>()

    this.runMiddlewares = compose([...opts.middlewares || [],
      defaultsMiddleware(baseURL, headers, params, timeout, retries, verbose),
      ...metrics ? [metricsMiddleware(metrics)] : [],
      memoizationMiddleware({memoizedCache}),
      singleFlightMiddleware,
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

  public delete = <T = void>(url: string, data?: any, config?: RequestConfig): Promise<IOResponse<T>> => {
    const deleteConfig: RequestConfig = {...config, url, data, method: 'delete'}
    return this.request(deleteConfig)
  }

  protected request = async (config: RequestConfig): Promise<AxiosResponse> => {
    const context: MiddlewareContext = {config}
    await this.runMiddlewares(context)
    return context.response!
  }
}
