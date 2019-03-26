import {AxiosRequestConfig, AxiosResponse} from 'axios'
import {URL, URLSearchParams} from 'url'
import {CacheLayer} from '../../caches/CacheLayer'
import {MiddlewareContext, RequestConfig} from '../context'

const ROUTER_CACHE_KEY = 'x-router-cache'
const ROUTER_CACHE_HIT = 'HIT'

export const cacheKey = (config: AxiosRequestConfig) => {
  const {baseURL = '', url = '', params} = config
  const fullURL = [baseURL, url].filter(str => str).join('/')
  const urlObject = new URL(fullURL)

  if (params) {
    for (const [key, value] of Object.entries<string>(params)) {
      urlObject.searchParams.append(key, value)
    }
  }

  // Replace forward slashes with backwards slashes for disk cache legibility
  const encodedPath = `${urlObject.pathname}${urlObject.search}`.replace(/\//g, '\\\\')
  // Add hostname as top level directory on disk cache
  return `${urlObject.hostname}/${encodedPath}`
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

export function isCacheable (arg: RequestConfig, type: CacheType): arg is CacheableRequestConfig {
  return arg && !!arg.cacheable
    && (arg.cacheable === type || arg.cacheable === CacheType.Any || type === CacheType.Any)
}

const addNotModified = (validateStatus: (status: number) => boolean) =>
  (status: number) => validateStatus(status) || status === 304

export enum CacheType {
  None,
  Memory,
  Disk,
  Any,
}

interface CacheOptions {
  type: CacheType
  storage: CacheLayer<string, Cached>
  segmentToken: string
}

export const cacheMiddleware = ({type, storage, segmentToken}: CacheOptions) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isCacheable(ctx.config, type)) {
      return await next()
    }

    const key = cacheKey(ctx.config)
    const keyWithSegment = key + segmentToken

    const cacheHasWithSegment = await storage.has(keyWithSegment)
    const cached = cacheHasWithSegment ? await storage.get(keyWithSegment) : await storage.get(key)

    if (cached) {
      const {etag: cachedEtag, response, expiration} = cached as Cached
      if (expiration > Date.now() && response) {
        ctx.response = response as AxiosResponse
        ctx.cacheHit = {
          memoized: 0,
          memory: 1,
          revalidated: 0,
          router: 0,
        }
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
      ctx.cacheHit = {
        memoized: 0,
        memory: 1,
        revalidated: 1,
        router: 0,
      }
    }

    const {data, headers, status} = ctx.response as AxiosResponse
    const {age, etag, maxAge, noStore, noCache} = parseCacheHeaders(headers)

    if (headers[ROUTER_CACHE_KEY] === ROUTER_CACHE_HIT) {
      if (ctx.cacheHit) {
        ctx.cacheHit.router = 1
      }
      else {
        ctx.cacheHit = {
          memoized: 0,
          memory: 0,
          revalidated: 0,
          router: 1,
        }
      }
    }

    // Indicates this should NOT be cached and this request will not be considered a miss.
    if (noStore || (noCache && !etag)) {
      return
    }

    const shouldCache = maxAge || etag

    // Add false to cacheHits to indicate this _should_ be cached but was as miss.
    if (!ctx.cacheHit && shouldCache) {
      ctx.cacheHit = {
        memoized: 0,
        memory: 0,
        revalidated: 0,
        router: 0,
      }
    }

    if (shouldCache) {
      const currentAge = revalidated ? 0 : age
      const varySegment = ctx.response.headers.vary.includes('x-vtex-segment')
      const setKey = varySegment ? keyWithSegment : key
      await storage.set(setKey, {
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
  cacheable: CacheType,
  memoizable: boolean
}
