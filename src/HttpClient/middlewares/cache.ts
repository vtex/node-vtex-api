import {AxiosRequestConfig, AxiosResponse} from 'axios'
import {URL, URLSearchParams} from 'url'
import {CacheLayer} from '../../caches/CacheLayer'
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

export const cacheMiddleware = ({cacheStorage, segmentToken}: {cacheStorage: CacheLayer<string, Cached>, segmentToken: string}) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isCacheable(ctx.config)) {
      return await next()
    }

    const key = cacheKey(ctx.config)
    const keyWithSegment = key + segmentToken

    const cacheHasWithSegment = await cacheStorage.has(keyWithSegment)
    const cached = cacheHasWithSegment ? await cacheStorage.get(keyWithSegment) : await cacheStorage.get(key)

    if (cached) {
      const {etag: cachedEtag, response, expiration} = cached as Cached
      if (expiration > Date.now() && response) {
        ctx.response = response as AxiosResponse
        return
      }

      const validateStatus = addNotModified(ctx.config.validateStatus!)
      if (cachedEtag && validateStatus(response.status as number)) {
        ctx.config.headers['if-none-match'] = cachedEtag
        ctx.config.validateStatus = validateStatus
      }
    }

    await next()

    if (!ctx.response) {
      return
    }

    const revalidated = ctx.response.status === 304
    if (revalidated && cached) {
      ctx.response = cached.response as AxiosResponse
    }

    const {data, headers, status} = ctx.response as AxiosResponse
    const {age, etag, maxAge, noStore} = parseCacheHeaders(headers)
    if (noStore && !etag) {
      return
    }

    if (maxAge || etag) {
      const currentAge = revalidated ? 0 : age
      debugger
      const varySegment = ctx.response.headers.vary.includes('x-vtex-segment')
      const setKey = varySegment ? keyWithSegment : key
      await cacheStorage.set(setKey, {
        etag,
        expiration: Date.now() + (maxAge - currentAge) * 1000,
        response: {data, headers, status},
      })
      return
    }
  }
}

export interface Cached {
  etag: string
  expiration: number
  response: Partial<AxiosResponse>
}

export type CacheableRequestConfig = AxiosRequestConfig & {
  url: string,
  cacheable: boolean,
}
