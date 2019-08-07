import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { URL } from 'url'

import { CacheLayer } from '../../caches/CacheLayer'
import { SEGMENT_HEADER, SESSION_HEADER } from '../../constants'
import { MiddlewareContext, RequestConfig } from '../typings'

const RANGE_HEADER_QS_KEY = '__range_header'
const cacheableStatusCodes = [
  200,
  203,
  204,
  206,
  300,
  301,
  404,
  405,
  410,
  414,
  501,
] // https://tools.ietf.org/html/rfc7231#section-6.1

export const cacheKey = (config: AxiosRequestConfig) => {
  const { baseURL = '', url = '', params, headers } = config
  const fullURL = [baseURL, url].filter(str => str).join('/')
  const urlObject = new URL(fullURL)

  if (headers && headers.range) {
    urlObject.searchParams.append(RANGE_HEADER_QS_KEY, headers.range)
  }

  if (params) {
    for (const [key, value] of Object.entries<string>(params)) {
      urlObject.searchParams.append(key, value)
    }
  }

  // Replace forward slashes with backwards slashes for disk cache legibility
  const encodedPath = `${urlObject.pathname}${urlObject.search}`.replace(
    /\//g,
    '\\\\'
  )
  // Add hostname as top level directory on disk cache
  return `${urlObject.hostname}/${encodedPath}`
}

const parseCacheHeaders = (headers: Record<string, string>) => {
  const { 'cache-control': cacheControl = '', etag, age: ageStr } = headers
  const cacheDirectives = cacheControl.split(',').map(d => d.trim())
  const maxAgeDirective = cacheDirectives.find(d => d.startsWith('max-age'))
  const [, maxAgeStr] = maxAgeDirective
    ? maxAgeDirective.split('=')
    : [null, null]
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

export function isLocallyCacheable(
  arg: RequestConfig,
  type: CacheType
): arg is CacheableRequestConfig {
  return (
    arg &&
    !!arg.cacheable &&
    !arg.headers[SESSION_HEADER] &&
    (arg.cacheable === type ||
      arg.cacheable === CacheType.Any ||
      type === CacheType.Any)
  )
}

const addNotModified = (validateStatus: (status: number) => boolean) => (
  status: number
) => validateStatus(status) || status === 304

export enum CacheType {
  None,
  Memory,
  Disk,
  Any,
}

interface CacheOptions {
  type: CacheType
  storage: CacheLayer<string, Cached>
}

export const cacheMiddleware = ({ type, storage }: CacheOptions) => {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isLocallyCacheable(ctx.config, type)) {
      return await next()
    }
    const key = cacheKey(ctx.config)
    const segmentToken = ctx.config.headers[SEGMENT_HEADER]
    const keyWithSegment = key + segmentToken

    const cacheHasWithSegment = await storage.has(keyWithSegment)
    const cached = cacheHasWithSegment
      ? await storage.get(keyWithSegment)
      : await storage.get(key)

    if (cached) {
      const {
        etag: cachedEtag,
        response,
        expiration,
        responseType,
        responseEncoding,
      } = cached as Cached
      if (expiration > Date.now() && response) {
        if (type === CacheType.Disk && responseType === 'arraybuffer') {
          response.data = Buffer.from(response.data, responseEncoding)
        }
        ctx.response = response as AxiosResponse
        ctx.cacheHit = {
          inflight: 0,
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
        inflight: 0,
        memoized: 0,
        memory: 1,
        revalidated: 1,
        router: 0,
      }
    }

    const { data, headers, status } = ctx.response as AxiosResponse
    const {
      age,
      etag,
      maxAge: headerMaxAge,
      noStore,
      noCache,
    } = parseCacheHeaders(headers)
    const { forceMaxAge } = ctx.config
    const maxAge =
      forceMaxAge && cacheableStatusCodes.includes(status)
        ? Math.max(forceMaxAge, headerMaxAge)
        : headerMaxAge

    // Indicates this should NOT be cached and this request will not be considered a miss.
    if (!forceMaxAge && (noStore || (noCache && !etag))) {
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
      const { responseType, responseEncoding } = ctx.config
      const currentAge = revalidated ? 0 : age
      const varySegment =
        ctx.response.headers.vary &&
        ctx.response.headers.vary.includes(SEGMENT_HEADER)
      const setKey = varySegment ? keyWithSegment : key
      const cacheableData =
        type === CacheType.Disk && responseType === 'arraybuffer'
          ? (data as Buffer).toString(responseEncoding)
          : data

      await storage.set(setKey, {
        etag,
        expiration: Date.now() + (maxAge - currentAge) * 1000,
        response: { data: cacheableData, headers, status },
        responseEncoding,
        responseType,
      })
      return
    }
  }
}

export interface Cached {
  etag: string
  expiration: number
  response: Partial<AxiosResponse>
  responseType?: string
  responseEncoding?: BufferEncoding
}

export type CacheableRequestConfig = RequestConfig & {
  url: string
  cacheable: CacheType
  memoizable: boolean
}
