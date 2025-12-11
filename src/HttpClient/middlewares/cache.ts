import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { Span } from 'opentracing'

import { CacheLayer } from '../../caches/CacheLayer'
import { HeaderKeys } from '../../constants'
import { IOContext } from '../../service/worker/runtime/typings'
import { ErrorReport } from '../../tracing'
import { HttpLogEvents } from '../../tracing/LogEvents'
import { HttpCacheLogFields } from '../../tracing/LogFields'
import { CustomHttpTags } from '../../tracing/Tags'
import { MiddlewareContext, RequestConfig } from '../typings'

const RANGE_HEADER_QS_KEY = '__range_header'
const cacheableStatusCodes = [200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501] // https://tools.ietf.org/html/rfc7231#section-6.1

export const cacheKey = (config: AxiosRequestConfig) => {
  const {baseURL = '', url = '', params, headers} = config
  const locale = headers?.[HeaderKeys.LOCALE]

  const encodedBaseURL = baseURL.replace(/\//g, '\\')
  const encodedURL = url.replace(/\//g, '\\')

  let key = `${locale}--${encodedBaseURL}--${encodedURL}?`

  if (params) {
    Object.keys(params).sort().forEach(p =>
      key = key.concat(`--${p}=${params[p]}`)
    )
  }
  if (headers?.range) {
    key = key.concat(`--${RANGE_HEADER_QS_KEY}=${headers.range}`)
  }

  return key
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

export function isLocallyCacheable (arg: RequestConfig, type: CacheType): arg is CacheableRequestConfig {
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

export const enum CacheResult {
  HIT = 'HIT',
  MISS = 'MISS',
  STALE = 'STALE',
}

const CacheTypeNames = {
  [CacheType.None]: 'none',
  [CacheType.Memory]: 'memory',
  [CacheType.Disk]: 'disk',
  [CacheType.Any]: 'any',
}

interface CacheOptions {
  type: CacheType
  storage: CacheLayer<string, Cached>
  asyncSet?: boolean
}

export const cacheMiddleware = ({ type, storage, asyncSet }: CacheOptions) => {
  const CACHE_RESULT_TAG = type === CacheType.Disk ? CustomHttpTags.HTTP_DISK_CACHE_RESULT : CustomHttpTags.HTTP_MEMORY_CACHE_RESULT
  const cacheType = CacheTypeNames[type]

  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    if (!isLocallyCacheable(ctx.config, type)) {
      return await next()
    }

    const { rootSpan: span, tracer, logger } = ctx.tracing ?? {}

    const key = cacheKey(ctx.config)
    const segmentToken = ctx.config.headers?.[HeaderKeys.SEGMENT]
    const keyWithSegment = key + segmentToken

    span?.log({
      event: HttpLogEvents.CACHE_KEY_CREATE,
      [HttpCacheLogFields.CACHE_TYPE]: cacheType,
      [HttpCacheLogFields.KEY]: key,
      [HttpCacheLogFields.KEY_WITH_SEGMENT]: keyWithSegment,
    })


    const cacheReadSpan = createCacheSpan(cacheType, 'read', tracer, span)
    let cached: void | Cached = undefined
    try {
      const cacheHasWithSegment = await storage.has(keyWithSegment)
      cached = cacheHasWithSegment ? await storage.get(keyWithSegment) : await storage.get(key)
    } catch (error: any) {
      ErrorReport.create({ originalError: error }).injectOnSpan(cacheReadSpan)
      logger?.warn({ message: 'Error reading from the HttpClient cache', error })
    } finally {
      cacheReadSpan?.finish()
    }

    if (cached && cached.response) {
      const {etag: cachedEtag, response, expiration, responseType, responseEncoding} = cached as Cached

      if (type === CacheType.Disk && responseType === 'arraybuffer') {
        response.data = Buffer.from(response.data, responseEncoding)
      }

      const now = Date.now()

      span?.log({
        event: HttpLogEvents.LOCAL_CACHE_HIT_INFO,
        [HttpCacheLogFields.CACHE_TYPE]: cacheType,
        [HttpCacheLogFields.ETAG]: cachedEtag,
        [HttpCacheLogFields.EXPIRATION_TIME]: (expiration-now)/1000,
        [HttpCacheLogFields.RESPONSE_TYPE]: responseType,
        [HttpCacheLogFields.RESPONSE_ENCONDING]: responseEncoding,
      })

      if (expiration > now) {
        ctx.response = response as AxiosResponse
        ctx.cacheHit = {
          memory: 1,
          revalidated: 0,
          router: 0,
        }

        span?.setTag(CACHE_RESULT_TAG, CacheResult.HIT)
        return
      }

      span?.setTag(CACHE_RESULT_TAG, CacheResult.STALE)
      const validateStatus = addNotModified(ctx.config.validateStatus!)
      if (cachedEtag && validateStatus(response.status as number)) {
        ctx.config.headers = {
          ...ctx.config.headers,
          'if-none-match': cachedEtag,
        }
        ctx.config.validateStatus = validateStatus
      }
    } else {
      span?.setTag(CACHE_RESULT_TAG, CacheResult.MISS)
    }

    await next()

    if (!ctx.response) {
      return
    }

    const revalidated = ctx.response.status === 304
    if (revalidated && cached) {
      ctx.response = cached.response as AxiosResponse
      ctx.cacheHit = {
        memory: 1,
        revalidated: 1,
        router: 0,
      }
    }

    const {data, headers, status} = ctx.response as AxiosResponse
    const {age, etag, maxAge: headerMaxAge, noStore, noCache} = parseCacheHeaders(headers)

    const {forceMaxAge} = ctx.config
    const maxAge = forceMaxAge && cacheableStatusCodes.includes(status) ? Math.max(forceMaxAge, headerMaxAge) : headerMaxAge

    span?.log({
      event: HttpLogEvents.CACHE_CONFIG,
      [HttpCacheLogFields.CACHE_TYPE]: cacheType,
      [HttpCacheLogFields.AGE]: age,
      [HttpCacheLogFields.CALCULATED_MAX_AGE]: maxAge,
      [HttpCacheLogFields.MAX_AGE]: headerMaxAge,
      [HttpCacheLogFields.FORCE_MAX_AGE]: forceMaxAge,
      [HttpCacheLogFields.ETAG]: etag,
      [HttpCacheLogFields.NO_CACHE]: noCache,
      [HttpCacheLogFields.NO_STORE]: noStore,
    })

    // Indicates this should NOT be cached and this request will not be considered a miss.
    if (!forceMaxAge && (noStore || (noCache && !etag))) {
      span?.log({ event: HttpLogEvents.NO_LOCAL_CACHE_SAVE, [HttpCacheLogFields.CACHE_TYPE]: cacheType })
      return
    }

    const shouldCache = maxAge || etag
    const varySession = ctx.response.headers.vary && ctx.response.headers.vary.includes(HeaderKeys.SESSION)
    if (shouldCache && !varySession) {
      const {responseType, responseEncoding: configResponseEncoding} = ctx.config
      const currentAge = revalidated ? 0 : age
      const varySegment = ctx.response.headers.vary && ctx.response.headers.vary.includes(HeaderKeys.SEGMENT)
      const setKey = varySegment ? keyWithSegment : key
      const responseEncoding = configResponseEncoding || (responseType === 'arraybuffer' ? 'base64' : undefined)
      const cacheableData = type === CacheType.Disk && responseType === 'arraybuffer'
        ? (data as Buffer).toString(responseEncoding)
        : data

      const now = Date.now()
      const expiration = now + (maxAge - currentAge) * 1000

      const alreadyExpired = expiration <= now
      const reusingRevalidatedCache = cached && (ctx.response === cached.response)
      const shouldSkipCacheUpdate = alreadyExpired && reusingRevalidatedCache
      if (shouldSkipCacheUpdate) {
        return
      }

      const cacheWriteSpan = createCacheSpan(cacheType, 'write', tracer, span)
      try {
        const storageSet = () =>
          storage.set(setKey, {
            etag,
            expiration,
            response: {data: cacheableData, headers, status},
            responseEncoding: responseEncoding as any,
            responseType,
          })
        if (asyncSet) {
          storageSet()
        } else {
          await storageSet()
          span?.log({
            event: HttpLogEvents.LOCAL_CACHE_SAVED,
            [HttpCacheLogFields.CACHE_TYPE]: cacheType,
            [HttpCacheLogFields.KEY_SET]: setKey,
            [HttpCacheLogFields.AGE]: currentAge,
            [HttpCacheLogFields.ETAG]: etag,
            [HttpCacheLogFields.EXPIRATION_TIME]: (expiration - Date.now())/1000,
            [HttpCacheLogFields.RESPONSE_ENCONDING]: responseEncoding,
            [HttpCacheLogFields.RESPONSE_TYPE]: responseType,
          })
        }
      } catch (error: any) {
        ErrorReport.create({ originalError: error }).injectOnSpan(cacheWriteSpan)
        logger?.warn({ message: 'Error writing to the HttpClient cache', error })
      } finally {
        cacheWriteSpan?.finish()
      }

      return
    }

    span?.log({ event: HttpLogEvents.NO_LOCAL_CACHE_SAVE, [HttpCacheLogFields.CACHE_TYPE]: cacheType })
  }
}

const createCacheSpan = (cacheType: string, operation: 'read' | 'write', tracer?: IOContext['tracer'], parentSpan?: Span) => {
  if (tracer && tracer.isTraceSampled && cacheType === 'disk') {
    return tracer.startSpan(`${operation}-disk-cache`, { childOf: parentSpan })
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
  url: string,
  cacheable: CacheType,
  memoizable: boolean
}
