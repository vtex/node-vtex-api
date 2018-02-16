import {AxiosInstance, AxiosResponse, AxiosRequestConfig} from 'axios'
import {URL, URLSearchParams} from 'url'

const EMPTY = {etag: null, response: null}

const successOrNotModified = (status: number): boolean =>
  status >= 200 && status < 300 || status === 304

function isCacheable (arg: any): arg is CacheableRequestConfig {
  return arg.cacheable !== undefined
}

const cacheKey = (config: AxiosRequestConfig) => {
  const url = new URL(config.url!)
  const params = new URLSearchParams(config.params)
  url.search = params.toString()
  return url.toString()
}

export const addCacheInterceptors = (http: AxiosInstance, cacheStorage: CacheStorage) => {
  http.interceptors.request.use((config: AxiosRequestConfig) => {
    if (isCacheable(config)) {
      const key = cacheKey(config)
      const {etag, response} = cacheStorage.get(key) || EMPTY
      if (etag) {
        config.headers['if-none-match'] = etag
        config.cached = response
        config.validateStatus = successOrNotModified
      }
    }

    return config
  })

  http.interceptors.response.use((response: AxiosResponse) => {
    const {status, data, headers, config} = response
    if (isCacheable(config)) {
      if (status === 304) {
        return config.cached
      }

      if (headers.etag) {
        const key = cacheKey(config)
        cacheStorage.set(key, {
          etag: headers.etag,
          response: {data, headers, status: 304},
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
