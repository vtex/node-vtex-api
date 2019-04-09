import {AxiosRequestConfig, AxiosResponse} from 'axios'
import {IAxiosRetryConfig} from 'axios-retry'

import { CacheType } from './middlewares/cache'

export type InflightKeyGenerator = (x: RequestConfig) => string

export interface RequestConfig extends AxiosRequestConfig {
  'axios-retry'?: IAxiosRetryConfig
  metric?: string
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
