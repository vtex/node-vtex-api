import { FORMAT_HTTP_HEADERS, SpanContext, Tracer } from 'opentracing'
import { ACCOUNT_HEADER, WORKSPACE_HEADER } from '../../constants'
import { Tags } from '../../tracing/Tags'
import { UserLandTracer } from '../../tracing/UserLandTracer'
import { ServiceContext } from '../worker/runtime/typings'
import { injectErrorOnSpan } from './spanSetup'

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
        [Tags.HTTP_URL]: ctx.request.originalUrl,
        [Tags.HTTP_METHOD]: ctx.request.method,
        [Tags.HTTP_PATH]: ctx.request.path,
        [Tags.VTEX_WORKSPACE]: ctx.headers[WORKSPACE_HEADER],
        [Tags.VTEX_ACCOUNT]: ctx.headers[ACCOUNT_HEADER],
      },
    })

    ctx.tracing = { currentSpan, tracer }

    try {
      await next()
    } catch (err) {
      injectErrorOnSpan(currentSpan, err)
      throw err
    } finally {
      currentSpan.setTag(Tags.HTTP_STATUS_CODE, ctx.response.status)
      currentSpan.finish()
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
    const userLandTracer = ctx.vtex.tracer!
    userLandTracer.setFallbackSpan(span)
    userLandTracer.lockFallbackSpan()

    try {
      await next()
    } catch (err) {
      injectErrorOnSpan(span, err)
      throw err
    } finally {
      span.finish()
      ctx.tracing = tracingCtx
    }
  }
}

export async function insertUserLandTracer(ctx: ServiceContext, next: () => Promise<void>) {
  ctx.vtex.tracer = new UserLandTracer(ctx.tracing!.tracer, ctx.tracing!.currentSpan)
  return next()
}
