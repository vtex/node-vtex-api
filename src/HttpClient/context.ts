import {AxiosRequestConfig, AxiosResponse} from 'axios'

export type MiddlewareContext = {
  config: AxiosRequestConfig
  response?: AxiosResponse,
}
