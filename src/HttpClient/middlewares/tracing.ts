import { MiddlewaresTracingContext, RequestConfig } from '..'
import { IOContext } from '../../service/worker/runtime/typings'
import { ErrorReport, getTraceInfo } from '../../tracing'
import { CustomHttpTags, GraphQLTags, OpentracingTags } from '../../tracing/Tags'
import { MiddlewareContext } from '../typings'
import { extractGraphQLOperationInfoSync } from '../utils/graphqlOperation'
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

/**
 * Detects if a request is a GraphQL request by checking the request body.
 * Returns the operation info if it's a GraphQL request, undefined otherwise.
 */
const detectGraphQLFromBody = (config: RequestConfig): { operationName: string; operationType: string } | undefined => {
  const { data } = config

  // Check if data looks like a GraphQL request (has a 'query' field with a string value)
  if (data && typeof data === 'object' && typeof data.query === 'string') {
    const operationInfo = extractGraphQLOperationInfoSync(data.query)
    return operationInfo
  }

  return undefined
}

export const createHttpClientTracingMiddleware = ({
  tracer,
  logger,
  clientName,
  hasMemoryCacheMiddleware,
  hasDiskCacheMiddleware,
}: HttpClientTracingMiddlewareConfig) => {
  return async function tracingMiddleware(ctx: MiddlewareContext, next: () => Promise<void>) {
    // First check if GraphQL info was explicitly set (from GraphQLClient)
    let graphqlOperationName: string | undefined = ctx.config.graphqlOperationName
    let graphqlOperationType: string | undefined = ctx.config.graphqlOperationType

    // If not explicitly set, try to detect from request body
    if (!graphqlOperationName) {
      const detectedInfo = detectGraphQLFromBody(ctx.config)
      if (detectedInfo) {
        graphqlOperationName = detectedInfo.operationName
        graphqlOperationType = detectedInfo.operationType
      }
    }

    const isGraphQLRequest = !!graphqlOperationName

    console.log('[GraphQL Debug] Request:', {
      url: ctx.config.url,
      method: ctx.config.method || 'GET',
      isGraphQLRequest,
      graphqlOperationName,
      graphqlOperationType,
    })

    if(!tracer.isTraceSampled){
      await next()

      // Log GraphQL operations even when trace is not sampled
      if (isGraphQLRequest) {
        logGraphQLOperation(logger, clientName, graphqlOperationName, graphqlOperationType, ctx.response?.status)
      }

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

    // Add GraphQL-specific tags when this is a GraphQL request
    if (isGraphQLRequest) {
      span?.addTags({
        [GraphQLTags.GRAPHQL_OPERATION_NAME]: graphqlOperationName,
        [GraphQLTags.GRAPHQL_OPERATION_TYPE]: graphqlOperationType,
      })
      const debugInfo = {
        'graphql.operation.name': graphqlOperationName,
        'graphql.operation.type': graphqlOperationType,
      }
      console.log('[GraphQL Debug] Added tags to span:', debugInfo)
      logger.info({
        message: '[GraphQL Debug] Added tags to span',
        ...debugInfo,
      })
    }

    let response
    let errorStatus: number | undefined
    try {
      await next()
      response = ctx.response
    } catch (err: any) {
      response = err.response
      errorStatus = err.response?.status
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

      // Log GraphQL operations
      if (isGraphQLRequest) {
        logGraphQLOperation(logger, clientName, graphqlOperationName, graphqlOperationType, response?.status ?? errorStatus)
      }

      span?.finish()
    }
  }
}

/**
 * Logs GraphQL operation details for observability.
 * Always logs to ensure visibility into GraphQL operations volume and errors.
 */
const logGraphQLOperation = (
  logger: IOContext['logger'],
  clientName: string,
  operationName: string | undefined,
  operationType: string | undefined,
  statusCode: number | undefined
) => {
  const logData = {
    message: 'GraphQL operation',
    graphqlClient: clientName,
    graphqlOperationName: operationName,
    graphqlOperationType: operationType,
    statusCode,
  }

  // Log as info for successful requests, warn for errors
  if (statusCode && statusCode >= 400) {
    logger.warn(logData)
  } else {
    logger.info(logData)
  }
}
