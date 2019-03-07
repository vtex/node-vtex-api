import {AxiosRequestConfig, AxiosResponse} from 'axios'
import {IAxiosRetryConfig} from 'axios-retry'

export interface RequestConfig extends AxiosRequestConfig {
  'axios-retry'?: IAxiosRetryConfig
  metric?: string
  production?: boolean
}

export interface MiddlewareContext {
  config: RequestConfig
  response?: AxiosResponse,
}
