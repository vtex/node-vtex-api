import {AxiosInstance, AxiosResponse, AxiosRequestConfig} from 'axios'

const addNotFound = (validateStatus: (status: number) => boolean) =>
  (status: number) => validateStatus(status) || status === 404

export function nullIfNotFound (config: any): boolean {
  return config && config.nullIfNotFound
}

export const addNotFoundRequestInterceptor = (http: AxiosInstance) => {
  http.interceptors.request.use((config: AxiosRequestConfig) => {
    if (nullIfNotFound(config)) {
      config.validateStatus = addNotFound(config.validateStatus!)
    }

    return config
  })
}

export const addNotFoundResponseInterceptor = (http: AxiosInstance) => {
  http.interceptors.response.use((response: AxiosResponse) => {
    if (nullIfNotFound(response.config) && response.status === 404) {
      response.data = null
    }

    return response
  })
}

export type IgnoreNotFoundRequestConfig = AxiosRequestConfig & {
  nullIfNotFound?: boolean,
}
