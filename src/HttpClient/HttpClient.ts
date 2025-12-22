import { AxiosResponse } from 'axios'
import { createHash } from 'crypto'
import { IncomingMessage } from 'http'
import compose from 'koa-compose'
import pLimit from 'p-limit'
import {
  HeaderKeys,
  BODY_HASH,
} from '../constants'
import { Logger } from '../service/logger'
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
import { defaultsMiddleware, requestMiddleware, routerCacheMiddleware } from './middlewares/request'
import { createHttpClientTracingMiddleware } from './middlewares/tracing'
import { InstanceOptions, IOResponse, MiddlewareContext, RequestConfig } from './typings'

const DEFAULT_TIMEOUT_MS = 1000
const noTransforms = [(data: any) => data]

type ClientOptions = IOContext & Partial<InstanceOptions>

export class HttpClient {
  public name: string

  private logger: Logger
  private cacheableType: CacheType
  private memoizable: boolean

  private runMiddlewares: compose.ComposedMiddleware<MiddlewareContext>

  public constructor(opts: ClientOptions) {
    const {
      account,
      baseURL,
      authToken,
      authType,
      memoryCache,
      diskCache,
      memoizable = true,
      asyncSetCache,
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
      httpsAgent,
      tracer,
      logger,
      cacheableType = CacheType.Memory,
    } = opts
    this.name = name || baseURL || 'unknown'
    this.logger = logger
    this.cacheableType = cacheableType
    this.memoizable = memoizable

    const limit = concurrency && concurrency > 0 && pLimit(concurrency) || undefined
    const headers: Record<string, string> = {
      ...defaultHeaders,
      'Accept-Encoding': 'gzip',
      'User-Agent': userAgent,
      ...account ? { [HeaderKeys.ACCOUNT]: account } : null,
      ...host ? { [HeaderKeys.FORWARDED_HOST]: host } : null,
      ...tenant ? { [HeaderKeys.TENANT]: formatTenantHeaderValue(tenant) } : null,
      ...binding ? { [HeaderKeys.BINDING]: formatBindingHeaderValue(binding) } : null,
      ...locale ? { [HeaderKeys.LOCALE]: locale } : null,
      ...operationId ? { [HeaderKeys.OPERATION_ID]: operationId } : null,
      ...product ? { [HeaderKeys.PRODUCT]: product } : null,
      ...segmentToken ? { [HeaderKeys.SEGMENT]: segmentToken } : null,
      ...sessionToken ? { [HeaderKeys.SESSION]: sessionToken } : null,
    }

    if (authType && authToken) {
      headers['Authorization'] = `${authType} ${authToken}` // tslint:disable-line
    }

    const memoizedCache = new Map<string, Promise<Memoized>>()

    this.runMiddlewares = compose([
      createHttpClientTracingMiddleware({ tracer, logger, clientName: this.name, hasDiskCacheMiddleware: !!diskCache, hasMemoryCacheMiddleware: !!memoryCache }),
      ...(opts.middlewares || []),
      defaultsMiddleware({ baseURL, rawHeaders: headers, params, timeout, retries, verbose, exponentialTimeoutCoefficient, initialBackoffDelay, exponentialBackoffCoefficient, httpsAgent }),
      metricsMiddleware({ metrics, serverTiming, name }),
      memoizationMiddleware({ memoizedCache }),
      ...recorder ? [recorderMiddleware(recorder)] : [],
      cancellationToken(cancellation),
      singleFlightMiddleware,
      acceptNotFoundMiddleware,
      ...memoryCache ? [cacheMiddleware({ type: CacheType.Memory, storage: memoryCache, asyncSet: asyncSetCache })] : [],
      ...diskCache ? [cacheMiddleware({ type: CacheType.Disk, storage: diskCache, asyncSet: asyncSetCache })] : [],
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
    const deterministicReplacer = (_ : any, v : any) => {
      try {
        return typeof v !== 'object' || v === null || Array.isArray(v) ? v :
                  Object.fromEntries(Object.entries(v).sort(([ka], [kb]) =>
                    ka < kb ? -1 : ka > kb ? 1 : 0))
      }
      catch(error) {
        // I don't believe this will ever happen, but just in case
        // Also, I didn't include error as I am unsure if it would have sensitive information
        this.logger.warn({message: 'Error while sorting object for cache key'})
        return v
      }
    }


    const bodyHash = createHash('md5').update(JSON.stringify(data, deterministicReplacer)).digest('hex')
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

  public getBuffer = (url: string, config: RequestConfig = {}): Promise<{ data: Buffer, headers: any }> => {
    const bufferConfig: RequestConfig = { cacheable: CacheType.Disk, ...config, url, responseType: 'arraybuffer', transformResponse: noTransforms }
    return this.request(bufferConfig)
  }

  public getStream = (url: string, config: RequestConfig = {}): Promise<IncomingMessage> => {
    const streamConfig: RequestConfig = { ...config, url, responseType: 'stream', transformResponse: noTransforms }
    return this.request(streamConfig).then(response => response.data as IncomingMessage)
  }

  public put = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<T> => {
    const putConfig: RequestConfig = { ...config, url, data, method: 'put' }
    return this.request(putConfig).then(response => response.data as T)
  }

  public putRaw = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<IOResponse<T>> => {
    const putConfig: RequestConfig = {...config, url, data, method: 'put'}
    return this.request(putConfig) as Promise<IOResponse<T>>
  }

  public post = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<T> => {
    const postConfig: RequestConfig = { ...config, url, data, method: 'post' }
    return this.request(postConfig).then(response => response.data as T)
  }

  public postRaw = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<IOResponse<T>> => {
    const postConfig: RequestConfig = { ...config, url, data, method: 'post' }
    return this.request(postConfig) as Promise<IOResponse<T>>
  }

  public patch = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<T> => {
    const patchConfig: RequestConfig = { ...config, url, data, method: 'patch' }
    return this.request(patchConfig).then(response => response.data as T)
  }

  public patchRaw = <T = void>(url: string, data?: any, config: RequestConfig = {}): Promise<IOResponse<T>> => {
    const patchConfig: RequestConfig = { ...config, url, data, method: 'patch' }
    return this.request(patchConfig).then(response => response.data as Promise<IOResponse<T>>)
  }

  public head = (url: string, config: RequestConfig = {}): Promise<IOResponse<void>> => {
    const headConfig: RequestConfig = { ...config, url, method: 'head' }
    return this.request(headConfig)
  }

  public delete = <T = void>(url: string, config?: RequestConfig): Promise<IOResponse<T>> => {
    const deleteConfig: RequestConfig = { ...config, url, method: 'delete' }
    return this.request(deleteConfig)
  }

  protected request = async (config: RequestConfig): Promise<AxiosResponse> => {
    const context: MiddlewareContext = { config }
    await this.runMiddlewares(context)
    return context.response!
  }

  private getConfig = (url: string, config: RequestConfig = {}): CacheableRequestConfig => ({
    cacheable: this.cacheableType,
    memoizable: this.memoizable,
    ...config,
    url,
  })
}
