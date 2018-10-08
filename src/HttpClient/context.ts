import {AxiosRequestConfig, AxiosResponse} from 'axios'

export interface RequestConfig extends AxiosRequestConfig {
  metric?: string
  production?: boolean
}

export interface MiddlewareContext {
  config: RequestConfig
  response?: AxiosResponse,
}
