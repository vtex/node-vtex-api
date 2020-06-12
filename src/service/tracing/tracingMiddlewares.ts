import { FORMAT_HTTP_HEADERS, SpanContext, Tracer } from 'opentracing'
import { ACCOUNT_HEADER, REQUEST_ID_HEADER, TRACE_ID_HEADER, WORKSPACE_HEADER } from '../../constants'
import { getTraceInfo, ErrorReport } from '../../tracing'
import { Tags } from '../../tracing/Tags'
import { UserLandTracer } from '../../tracing/UserLandTracer'
import { ServiceContext } from '../worker/runtime/typings'

const PATHS_BLACKLISTED_FOR_TRACING = ['/metrics', '/_status', '/healthcheck']

export const addTracingMiddleware = (tracer: Tracer) => {
  return async function addTracing(ctx: ServiceContext, next: () => Promise<void>) {
    if (PATHS_BLACKLISTED_FOR_TRACING.includes(ctx.request.path)) {
      return next()
    }

    const rootSpan = tracer.extract(FORMAT_HTTP_HEADERS, ctx.request.headers) as undefined | SpanContext

    const currentSpan = tracer.startSpan('unknown-operation', {
      childOf: rootSpan,
      tags: {
        [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_SERVER,
        [Tags.HTTP_URL]: ctx.request.href,
        [Tags.HTTP_METHOD]: ctx.request.method,
        [Tags.HTTP_PATH]: ctx.request.path,
        [Tags.VTEX_REQUEST_ID]: ctx.get(REQUEST_ID_HEADER),
        [Tags.VTEX_WORKSPACE]: ctx.get(WORKSPACE_HEADER),
        [Tags.VTEX_ACCOUNT]: ctx.get(ACCOUNT_HEADER),
      },
    })

    ctx.tracing = { currentSpan, tracer }

    currentSpan.log({ event: 'request-headers', headers: ctx.request.headers })

    try {
      await next()
    } catch (err) {
      ErrorReport.maybeWrapError(err).injectOnSpan(currentSpan)
      throw err
    } finally {
      currentSpan.setTag(Tags.HTTP_STATUS_CODE, ctx.response.status)
      currentSpan.log({ event: 'response-headers', headers: ctx.response.headers })
      currentSpan.finish()

      const traceInfo = getTraceInfo(currentSpan)
      if (traceInfo.isSampled) {
        ctx.set(TRACE_ID_HEADER, traceInfo.traceId)
      }
    }
  }
}

export const nameSpanOperationMiddleware = (operationType: string, operationName: string) => {
  return function nameSpanOperation(ctx: ServiceContext, next: () => Promise<void>) {
    ctx.tracing?.currentSpan.setOperationName(`${operationType}:${operationName}`)
    return next()
  }
}

export const traceUserLandRemainingPipelineMiddleware = (spanName: string, tags: Record<string, string> = {}) => {
  return async function traceUserLandRemainingPipeline(ctx: ServiceContext, next: () => Promise<void>) {
    const tracingCtx = ctx.tracing!
    ctx.tracing = undefined

    const span = tracingCtx.tracer.startSpan(spanName, { childOf: tracingCtx.currentSpan, tags })
    const userLandTracer = ctx.vtex.tracer! as UserLandTracer
    userLandTracer.setFallbackSpan(span)
    userLandTracer.lockFallbackSpan()

    try {
      await next()
    } catch (err) {
      ErrorReport.maybeWrapError(err).injectOnSpan(span)
      throw err
    } finally {
      ctx.tracing = tracingCtx
      span.finish()
    }
  }
}
