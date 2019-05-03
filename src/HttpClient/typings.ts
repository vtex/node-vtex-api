import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { IAxiosRetryConfig } from 'axios-retry'
import { Middleware } from 'koa-compose'

import { CacheLayer } from '../caches/CacheLayer'
import { MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { Cached, CacheType } from './middlewares/cache'

export type InflightKeyGenerator = (x: RequestConfig) => string

export interface RequestConfig extends AxiosRequestConfig {
  'axios-retry'?: IAxiosRetryConfig
  /**
   * Identifies the type of request for metrification purposes. Should vary with client method.
   */
  metric?: string
  /**
   * In verbose mode, a counter will be incremented for each request made with the same `metric` label.
   */
  count?: number
  /**
   * In verbose mode, a label will be created with a counter for each request made with the same `metric` label.
   */
  label?: string
  /**
   * Outputs verbose logs to console for this request.
   */
  verbose?: boolean
  production?: boolean
  cacheable?: CacheType
  memoizeable?: boolean
  inflightKey?: InflightKeyGenerator
  forceMaxAge?: number
  responseEncoding?: string
}

export interface CacheHit {
  disk?: 0 | 1
  memory?: 0 | 1
  revalidated?: 0 | 1
  router?: 0 | 1
  memoized?: 0 | 1
  inflight?: 0 | 1
}

export interface MiddlewareContext {
  config: RequestConfig
  response?: AxiosResponse
  cacheHit?: CacheHit
}

export type CacheStorage = CacheLayer<string, Cached>

export { Recorder } from './middlewares/recorder'

export interface InstanceOptions {
  authType?: AuthType
  timeout?: number
  memoryCache?: CacheLayer<string, Cached>
  diskCache?: CacheLayer<string, Cached>
  baseURL?: string
  retries?: number
  /**
   * @deprecated use retries instead.
   * @memberof InstanceOptions
   */
  retryConfig?: void
  metrics?: MetricsAccumulator
  /**
   * Maximum number of concurrent requests
   *
   * @type {number}
   * @memberof InstanceOptions
   */
  concurrency?: number
  /**
   * Default headers to be sent with every request
   *
   * @type {Record<string, string>}
   * @memberof InstanceOptions
   */
  headers?: Record<string, string>
  /**
   * Default query string parameters to be sent with every request
   *
   * @type {Record<string, string>}
   * @memberof InstanceOptions
   */
  params?: Record<string, string>
  middlewares?: Array<Middleware<MiddlewareContext>>
  verbose?: boolean
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
