import {AxiosRequestConfig, AxiosResponse} from 'axios'
import {URL, URLSearchParams} from 'url'
import {MiddlewareContext} from '../context'

const cacheKey = (config: AxiosRequestConfig) => {
  const {baseURL = '', url = '', params} = config
  const fullURL = [baseURL, url].filter(str => str).join('/')
  const urlObject = new URL(fullURL)
  const searchParams = new URLSearchParams(params)
  urlObject.search = searchParams.toString()
  return urlObject.toString()
}

const parseCacheHeaders = (headers: Record<string, string>) => {
  const {'cache-control': cacheControl = '', etag, age: ageStr} = headers
  const cacheDirectives = cacheControl.split(',').map(d => d.trim())
  const maxAgeDirective = cacheDirectives.find(d => d.startsWith('max-age'))
  const [, maxAgeStr] = maxAgeDirective ? maxAgeDirective.split('=') : [null, null]
  const maxAge = maxAgeStr ? parseInt(maxAgeStr, 10) : 0
  const age = ageStr ? parseInt(ageStr, 10) : 0

  return {
    age,
    etag,
    maxAge,
    noCache: cacheDirectives.indexOf('no-cache') !== -1,
    noStore: cacheDirectives.indexOf('no-store') !== -1,
  }
}

function isCacheable (arg: any): arg is CacheableRequestConfig {
  return arg && arg.cacheable
}

const addNotModified = (validateStatus: (status: number) => boolean) =>
  (status: number) => validateStatus(status) || status === 304

export const cacheMiddleware = (cacheStorage: CacheStorage) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isCacheable(ctx.config)) {
      return await next()
    }

    const key = cacheKey(ctx.config)
    const cached = cacheStorage.get<Cached>(key)

    if (cached) {
      const {etag, response, expiration} = cached
      if (expiration > Date.now()) {
        ctx.response = response
        return
      }

      const validateStatus = addNotModified(ctx.config.validateStatus!)
      if (etag && validateStatus(response.status)) {
        ctx.config.headers['if-none-match'] = etag
        ctx.config.validateStatus = validateStatus
      }
    }

    await next()

    if (!ctx.response) {
      return
    }

    const revalidated = ctx.response.status === 304
    if (revalidated) {
      ctx.response = cached!.response
    }

    const {data, headers, status} = ctx.response
    const {age, etag, maxAge, noStore} = parseCacheHeaders(headers)
    if (noStore && !etag) {
      return
    }

    if (maxAge || etag) {
      const currentAge = revalidated ? 0 : age
      cacheStorage.set(key, {
        etag,
        response: {data, headers, status},
        expiration: Date.now() + (maxAge - currentAge) * 1000,
      })
      return
    }
  }
}

interface Cached {
  etag: string
  expiration: number
  response: AxiosResponse
}

export interface CacheStorage {
  get<T> (key: string): T | undefined
  set (key: string, value: any): void
}

export type CacheableRequestConfig = AxiosRequestConfig & {
  url: string,
  cacheable: boolean,
}
