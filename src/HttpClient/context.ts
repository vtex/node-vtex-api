import {AxiosRequestConfig, AxiosResponse} from 'axios'
import {IAxiosRetryConfig} from 'axios-retry'

import { CacheType } from './middlewares/cache'

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
