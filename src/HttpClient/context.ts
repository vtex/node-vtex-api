import {AxiosRequestConfig, AxiosResponse} from 'axios'

export interface MiddlewareContext {
  config: AxiosRequestConfig
  response?: AxiosResponse,
}
