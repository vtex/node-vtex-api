import { AxiosResponse } from 'axios'
import { createHash } from 'crypto'
import { IncomingMessage } from 'http'
import compose from 'koa-compose'
import pLimit from 'p-limit'

import {
  BINDING_HEADER,
  BODY_HASH,
  FORWARDED_HOST_HEADER,
  LOCALE_HEADER,
  PRODUCT_HEADER,
  SEGMENT_HEADER,
  SESSION_HEADER,
  TENANT_HEADER,
} from '../constants'
import { IOContext } from '../service/worker/runtime/typings'
import { formatBindingHeaderValue } from '../utils/binding'
import { formatTenantHeaderValue } from '../utils/tenant'
import { CacheableRequestConfig, cacheMiddleware, CacheType } from './middlewares/cache'
import { cancellationToken } from './middlewares/cancellationToken'
import { singleFlightMiddleware } from './middlewares/inflight'
import { memoizationMiddleware, Memoized } from './middlewares/memoization'
import { metricsMiddleware } from './middlewares/metrics'
import { acceptNotFoundMiddleware, notFoundFallbackMiddleware } from './middlewares/notFound'
import { recorderMiddleware } from './middlewares/recorder'
import { defaultsMiddleware, requestMiddleware, routerCacheMiddleware, retryMiddleware } from './middlewares/request'
import { InstanceOptions, IOResponse, MiddlewareContext, RequestConfig } from './typings'

const DEFAULT_TIMEOUT_MS = 1000
const noTransforms = [(data: any) => data]

type ClientOptions = IOContext & Partial<InstanceOptions>

export class HttpClient {
  public name: string

  private runMiddlewares: compose.ComposedMiddleware<MiddlewareContext>

  public constructor (opts: ClientOptions) {
    const {
      baseURL,
      authToken,
      authType,
      memoryCache,
      diskCache,
      locale,
      name,
      metrics,
      product,
      serverTiming,
      recorder,
      userAgent,
      timeout = DEFAULT_TIMEOUT_MS,
      segmentToken,
      sessionToken,
      retries,
      concurrency,
      headers: defaultHeaders,
      host,
      params, operationId,
      tenant,
      binding,
      verbose,
      cancellation,
      exponentialTimeoutCoefficient,
      initialBackoffDelay,
      exponentialBackoffCoefficient,
    } = opts
    this.name = name || baseURL || 'unknown'
    const limit = concurrency && concurrency > 0 && pLimit(concurrency) || undefined
    const headers: Record<string, string> = {
      ...defaultHeaders,
      'Accept-Encoding': 'gzip',
      'User-Agent': userAgent,
      ... host ? {[FORWARDED_HOST_HEADER]: host} : null,
      ... tenant ? {[TENANT_HEADER]: formatTenantHeaderValue(tenant)} : null,
      ... binding ? {[BINDING_HEADER]: formatBindingHeaderValue(binding)} : null,
      ... locale ? {[LOCALE_HEADER]: locale} : null,
      ... operationId ? {'x-vtex-operation-id': operationId} : null,
      ... product ? {[PRODUCT_HEADER]: product} : null,
      ... segmentToken ? {[SEGMENT_HEADER]: segmentToken} : null,
      ... sessionToken ? {[SESSION_HEADER]: sessionToken} : null,
    }

    if (authType && authToken) {
      headers['Authorization'] = `${authType} ${authToken}` // tslint:disable-line
    }

    const memoizedCache = new Map<string, Promise<Memoized>>()

    this.runMiddlewares = compose([...opts.middlewares || [],
      defaultsMiddleware(baseURL, headers, params, timeout, retries, verbose),
      retryMiddleware(exponentialTimeoutCoefficient, retries, initialBackoffDelay, exponentialBackoffCoefficient),
      metricsMiddleware({metrics, serverTiming, name}),
      memoizationMiddleware({memoizedCache}),
      ...recorder ? [recorderMiddleware(recorder)] : [],
      cancellationToken(cancellation),
      singleFlightMiddleware,
      acceptNotFoundMiddleware,
      ...memoryCache ? [cacheMiddleware({type: CacheType.Memory, storage: memoryCache})] : [],
      ...diskCache ? [cacheMiddleware({type: CacheType.Disk, storage: diskCache})] : [],
      notFoundFallbackMiddleware,
      routerCacheMiddleware,
      requestMiddleware(limit),
    ])
  }

  public get = <T = any>(url: string, config: RequestConfig = {}): Promise<T> => {
    const cacheableConfig = this.getConfig(url, config)
    return this.request(cacheableConfig).then(response => response.data)
  }

  public getRaw = <T = any>(url: string, config: RequestConfig = {}): Promise<IOResponse<T>> => {
    const cacheableConfig = this.getConfig(url, config)
    return this.request(cacheableConfig)
  }

  public getWithBody = <T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<T> => {
    const bodyHash = createHash('md5').update(JSON.stringify(data, null, 2)).digest('hex')
    const cacheableConfig = this.getConfig(url, {
      ...config,
      data,
      params: {
        ...config.params,
        [BODY_HASH]: bodyHash,
      },
    })
    return this.request(cacheableConfig).then(response => response.data)
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

  public head = (url: string, config:RequestConfig = {}): Promise<IOResponse<void>> => {
    const headConfig: RequestConfig = {...config, url, method: 'head'}
    return this.request(headConfig)
  }

  public delete = <T = void>(url: string, config?: RequestConfig): Promise<IOResponse<T>> => {
    const deleteConfig: RequestConfig = {...config, url, method: 'delete'}
    return this.request(deleteConfig)
  }

  protected request = async (config: RequestConfig): Promise<AxiosResponse> => {
    const context: MiddlewareContext = {config}
    await this.runMiddlewares(context)
    return context.response!
  }

  private getConfig = (url: string, config: RequestConfig = {}): CacheableRequestConfig => ({
    cacheable: CacheType.Memory,
    memoizable: true,
    ...config,
    url,
  })
}
