import {AxiosInstance, AxiosResponse, AxiosRequestConfig} from 'axios'
import {URL, URLSearchParams} from 'url'

const EMPTY = {etag: null, response: null}

const addNotModified = (validateStatus: (status: number) => boolean) =>
  (status: number) => validateStatus(status) || status === 304

function isCacheable (arg: any): arg is CacheableRequestConfig {
  return arg && arg.cacheable
}

const cacheKey = (config: AxiosRequestConfig) => {
  const url = new URL(config.url!)
  const params = new URLSearchParams(config.params)
  url.search = params.toString()
  return config.baseURL
    ? config.baseURL + url.toString()
    : url.toString()
}

export const addCacheInterceptors = (http: AxiosInstance, cacheStorage: CacheStorage) => {
  http.interceptors.request.use((config: AxiosRequestConfig) => {
    if (isCacheable(config)) {
      const key = cacheKey(config)
      const {etag, response} = cacheStorage.get(key) || EMPTY
      const validateStatus = addNotModified(config.validateStatus!)
      if (etag && validateStatus(response.status)) {
        config.headers['if-none-match'] = etag
        config.cached = response
        config.validateStatus = validateStatus
      }
    }

    return config
  })

  http.interceptors.response.use((response: AxiosResponse) => {
    const {status, data, headers, config} = response
    if (isCacheable(config)) {
      if (status === 304) {
        return {...config.cached, status: 304}
      }

      if (headers.etag) {
        const key = cacheKey(config)
        cacheStorage.set(key, {
          etag: headers.etag,
          response: {data, headers, status},
        })
      }
    }

    return response
  })
}

export interface CacheStorage {
  get<T> (key: string): T | undefined
  set (key: string, value: any): void
}

export type CacheableRequestConfig = AxiosRequestConfig & {
  url: string,
  cacheable: boolean,
  cached?: any,
}
