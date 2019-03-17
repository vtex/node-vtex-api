import {AxiosRequestConfig, AxiosResponse} from 'axios'
import {IAxiosRetryConfig} from 'axios-retry'

import { CacheType } from './middlewares/cache'

export interface RequestConfig extends AxiosRequestConfig {
  'axios-retry'?: IAxiosRetryConfig
  metric?: string
  production?: boolean
  cacheable?: CacheType
}

export interface CacheHit {
  disk?: boolean
  memory?: boolean
  revalidated?: boolean
  router?: boolean
}

export interface MiddlewareContext {
  config: RequestConfig
  response?: AxiosResponse
  cacheHit?: CacheHit | false
}
