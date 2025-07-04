import { FORMAT_HTTP_HEADERS, SpanContext, Tracer } from 'opentracing'
import { finished as onStreamFinished } from 'stream'
import { HeaderKeys } from '../../constants'
import { ErrorReport, getTraceInfo } from '../../tracing'
import { RuntimeLogEvents } from '../../tracing/LogEvents'
import { RuntimeLogFields } from '../../tracing/LogFields'
import { CustomHttpTags, OpentracingTags, VTEXIncomingRequestTags } from '../../tracing/Tags'
import { UserLandTracer } from '../../tracing/UserLandTracer'
import { cloneAndSanitizeHeaders } from '../../tracing/utils'
import { hrToMillis } from '../../utils'
import { ServiceContext } from '../worker/runtime/typings'

const PATHS_BLACKLISTED_FOR_TRACING = ['/_status', '/healthcheck']

export const addTracingMiddleware = (tracer: Tracer) => {

  return async function addTracing(ctx: ServiceContext, next: () => Promise<void>) {
    const rootSpan = tracer.extract(FORMAT_HTTP_HEADERS, ctx.request.headers) as undefined | SpanContext
    ctx.tracing = { tracer, currentSpan: undefined}

    if (!shouldTrace(ctx, rootSpan)) {
      await next()
      return
    }

    const currentSpan = tracer.startSpan('unknown-operation', {
      childOf: rootSpan,
      tags: { [OpentracingTags.SPAN_KIND]: OpentracingTags.SPAN_KIND_RPC_SERVER },
    })

    const initialSamplingDecision = getTraceInfo(currentSpan).isSampled

    ctx.tracing = { currentSpan, tracer }

    let responseClosed = false
    ctx.res.once('close', () => (responseClosed = true))

    try {
      await next()
    } catch (err: any) {
      ErrorReport.create({ originalError: err }).injectOnSpan(currentSpan, ctx.vtex?.logger)
      throw err
    } finally {
      const traceInfo = getTraceInfo(currentSpan)
      if (traceInfo?.isSampled) {
        if (!initialSamplingDecision) {
          currentSpan?.setTag(OpentracingTags.SPAN_KIND, OpentracingTags.SPAN_KIND_RPC_SERVER)
        }

        currentSpan?.addTags({
          [OpentracingTags.HTTP_URL]: ctx.request.href,
          [OpentracingTags.HTTP_METHOD]: ctx.request.method,
          [OpentracingTags.HTTP_STATUS_CODE]: ctx.response.status,
          [CustomHttpTags.HTTP_PATH]: ctx.request.path,
          [VTEXIncomingRequestTags.VTEX_REQUEST_ID]: ctx.get(HeaderKeys.REQUEST_ID),
          [VTEXIncomingRequestTags.VTEX_WORKSPACE]: ctx.get(HeaderKeys.WORKSPACE),
          [VTEXIncomingRequestTags.VTEX_ACCOUNT]: ctx.get(HeaderKeys.ACCOUNT),
        })

        currentSpan?.log(cloneAndSanitizeHeaders(ctx.request.headers, 'req.headers.'))
        currentSpan?.log(cloneAndSanitizeHeaders(ctx.response.headers, 'res.headers.'))
        ctx.set(HeaderKeys.TRACE_ID, traceInfo.traceId!)
      }

      const onResFinished = () => {
        currentSpan?.finish()
      }

      if (responseClosed) {
        onResFinished()
      } else {
        onStreamFinished(ctx.res, onResFinished)
      }
    }
  }
}

export const nameSpanOperationMiddleware = (operationType: string, operationName: string) => {
  return function nameSpanOperation(ctx: ServiceContext, next: () => Promise<void>) {
    ctx.requestHandlerName = `${operationType}:${operationName}`
    ctx.tracing?.currentSpan?.setOperationName(ctx.requestHandlerName)
    return next()
  }
}

export const traceUserLandRemainingPipelineMiddleware = () => {
  return async function traceUserLandRemainingPipeline(ctx: ServiceContext, next: () => Promise<void>) {
    const tracingCtx = ctx.tracing
    ctx.tracing = undefined

    const span = tracingCtx?.currentSpan
    const userLandTracer = ctx.vtex.tracer! as UserLandTracer
    userLandTracer.setFallbackSpan(span)
    userLandTracer.lockFallbackSpan()
    const startTime = process.hrtime()

    try {
      span?.log({ event: RuntimeLogEvents.USER_MIDDLEWARES_START })
      await next()
    } catch (err: any) {
      ErrorReport.create({ originalError: err }).injectOnSpan(span, ctx.vtex.logger)
      throw err
    } finally {
      span?.log({
        event: RuntimeLogEvents.USER_MIDDLEWARES_FINISH,
        [RuntimeLogFields.USER_MIDDLEWARES_DURATION]: hrToMillis(process.hrtime(startTime)),
      })
      ctx.tracing = tracingCtx
    }
  }
}
function shouldTrace(ctx: ServiceContext, rootSpan: SpanContext | undefined) {
  /** Should trace if path isnt blacklisted and sampling decision came from the edge
   * ((rootSpan as any).isSampled. returns whether or not this span context was sampled
   * There is a cast to bypass opentracing typescript
   */
  return !PATHS_BLACKLISTED_FOR_TRACING.includes(ctx.request.path) && ((rootSpan as any).isSampled?.() ?? false)
}

