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
}

export interface CacheHit {
  disk?: boolean
  memory?: boolean
  revalidated?: boolean
  router?: boolean
  memoized?: boolean
  inflight?: boolean
}

export interface MiddlewareContext {
  config: RequestConfig
  response?: AxiosResponse
  cacheHit?: CacheHit | false
}
