import { MiddlewaresTracingContext, RequestConfig } from '..'
import { IOContext } from '../../service/worker/runtime/typings'
import { ErrorReport, getTraceInfo } from '../../tracing'
import { CustomHttpTags, OpentracingTags } from '../../tracing/Tags'
import { MiddlewareContext } from '../typings'
import { CacheType, isLocallyCacheable } from './cache'

interface HttpClientTracingMiddlewareConfig {
  clientName: string
  tracer: IOContext['tracer']
  logger: IOContext['logger']
  hasMemoryCacheMiddleware: boolean
  hasDiskCacheMiddleware: boolean
}

export interface TraceableRequestConfig extends RequestConfig {
  tracing: MiddlewaresTracingContext
}

export const createHttpClientTracingMiddleware = ({
  tracer,
  logger,
  clientName,
  hasMemoryCacheMiddleware,
  hasDiskCacheMiddleware,
}: HttpClientTracingMiddlewareConfig) => {
  return async function tracingMiddleware(ctx: MiddlewareContext, next: () => Promise<void>) {
    if(!tracer.isTraceSampled){
      await next()
      return
    }

    const rootSpan = tracer.fallbackSpanContext()
    const { requestSpanNameSuffix } = ctx.config.tracing || {}
    const spanName = requestSpanNameSuffix ? `request:${requestSpanNameSuffix}` : 'request'
    const span = tracer.startSpan(spanName, {childOf: rootSpan})

    ctx.tracing = {
      ...ctx.config.tracing,
      isSampled: getTraceInfo(span).isSampled,
      logger,
      rootSpan: span,
      tracer,
    }

    // We can't pass ctx.tracing to axios, so we pass ctx.config.tracing with
    // a reference to the ctx.tracing object (axios only receives the config object)
    ;(ctx.config as TraceableRequestConfig).tracing = ctx.tracing

    const hasMemoCache = !(!isLocallyCacheable(ctx.config, CacheType.Any) || !ctx.config.memoizable)
    const hasMemoryCache = hasMemoryCacheMiddleware && !!isLocallyCacheable(ctx.config, CacheType.Memory)
    const hasDiskCache = hasDiskCacheMiddleware && !!isLocallyCacheable(ctx.config, CacheType.Disk)

    span?.addTags({
      [CustomHttpTags.HTTP_MEMOIZATION_CACHE_ENABLED]: hasMemoCache,
      [CustomHttpTags.HTTP_MEMORY_CACHE_ENABLED]: hasMemoryCache,
      [CustomHttpTags.HTTP_DISK_CACHE_ENABLED]: hasDiskCache,
      [CustomHttpTags.HTTP_CLIENT_NAME]: clientName,
    })

    let response
    try {
      await next()
      response = ctx.response
    } catch (err: any) {
      response = err.response
      if(ctx.tracing?.isSampled) {
        ErrorReport.create({ originalError: err }).injectOnSpan(span, logger)
      }

      throw err
    } finally {
      if (response) {
        span?.setTag(OpentracingTags.HTTP_STATUS_CODE, response.status)
      } else {
        span?.setTag(CustomHttpTags.HTTP_NO_RESPONSE, true)
      }

      span?.finish()
    }
  }
}
