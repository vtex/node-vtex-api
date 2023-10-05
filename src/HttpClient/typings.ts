import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { Middleware } from 'koa-compose'
import { Span } from 'opentracing'

import { CacheLayer } from '../caches/CacheLayer'
import { MetricsAccumulator } from '../metrics/MetricsAccumulator'
import { IOContext } from '../service/worker/runtime/typings'
import { SpanReferenceTypes } from '../tracing'
import { IUserLandTracer } from '../tracing/UserLandTracer'
import { Cached, CacheType } from './middlewares/cache'

export type InflightKeyGenerator = (x: RequestConfig) => string

interface RequestTracingUserConfig {
  rootSpan?: Span
  referenceType?: SpanReferenceTypes
  requestSpanNameSuffix?: string
}

export interface RequestTracingConfig {
  tracing?: RequestTracingUserConfig
}

export interface RequestConfig extends AxiosRequestConfig, RequestTracingConfig {
  retries?: number
  exponentialTimeoutCoefficient?: number
  initialBackoffDelay?: number
  exponentialBackoffCoefficient?: number
  retryCount?: number
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
  responseEncoding?: BufferEncoding
  nullIfNotFound?: boolean
  ignoreRecorder?: boolean
}

export interface CacheHit {
  disk?: 0 | 1
  memory?: 0 | 1
  revalidated?: 0 | 1
  router?: 0 | 1
}

export interface MiddlewaresTracingContext extends Omit<RequestTracingUserConfig, 'rootSpan'> {
  tracer: IUserLandTracer
  logger: IOContext['logger']
  rootSpan?: Span
  isSampled: boolean
}

export interface MiddlewareContext {
  config: RequestConfig
  tracing?: MiddlewaresTracingContext
  response?: AxiosResponse
  cacheHit?: CacheHit
  inflightHit?: boolean
  memoizedHit?: boolean
}

export type CacheStorage = CacheLayer<string, Cached>

export interface InstanceOptions {
  authType?: AuthType
  timeout?: number
  memoryCache?: CacheLayer<string, Cached>
  diskCache?: CacheLayer<string, Cached>

  /**
   * Enables memoization, ephemeral within each request, for all requests of this client.
   * Useful for services that makes recursive requests, like graphql resolvers, which
   * might fetch the same endpoint more than once.
   * If that's not the case for your service, disabling it might improve the CPU and
   * memory usage.
   *
   * Default value: true
   */
  memoizable?: boolean

  baseURL?: string
  retries?: number
  exponentialTimeoutCoefficient?: number
  initialBackoffDelay?: number
  exponentialBackoffCoefficient?: number
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
  name?: string
  serverTimings?: Record<string, string>
  httpsAgent?: AxiosRequestConfig['httpsAgent']
  cacheableType?: CacheType
}

export interface IOResponse<T> {
  data: T
  headers: Record<string, string>
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
