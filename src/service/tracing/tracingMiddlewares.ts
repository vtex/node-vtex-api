import { FORMAT_HTTP_HEADERS, SpanContext, Tracer } from 'opentracing'
import { ACCOUNT_HEADER, REQUEST_ID_HEADER, TRACE_ID_HEADER, WORKSPACE_HEADER } from '../../constants'
import { ErrorReport, getTraceInfo } from '../../tracing'
import { RuntimeLogEvents } from '../../tracing/LogEvents'
import { RuntimeLogFields } from '../../tracing/LogFields'
import { CustomHttpTags, OpentracingTags, VTEXIncomingRequestTags } from '../../tracing/Tags'
import { UserLandTracer } from '../../tracing/UserLandTracer'
import { hrToMillis } from '../../utils'
import { addPrefixOntoObjectKeys } from '../../utils/addPrefixOntoObjectKeys'
import { ServiceContext } from '../worker/runtime/typings'

const PATHS_BLACKLISTED_FOR_TRACING = ['/metrics', '/_status', '/healthcheck']

export const addTracingMiddleware = (tracer: Tracer) => {
  return async function addTracing(ctx: ServiceContext, next: () => Promise<void>) {
    if (PATHS_BLACKLISTED_FOR_TRACING.includes(ctx.request.path)) {
      return next()
    }

    const rootSpan = tracer.extract(FORMAT_HTTP_HEADERS, ctx.request.headers) as undefined | SpanContext
    const currentSpan = tracer.startSpan('unknown-operation', { childOf: rootSpan })
    ctx.tracing = { currentSpan, tracer }

    try {
      await next()
    } catch (err) {
      ErrorReport.create({ originalError: err }).injectOnSpan(currentSpan, ctx.vtex?.logger)
      throw err
    } finally {
      const traceInfo = getTraceInfo(currentSpan)
      if (traceInfo.isSampled) {
        currentSpan.addTags({
          [OpentracingTags.SPAN_KIND]: OpentracingTags.SPAN_KIND_RPC_SERVER,
          [OpentracingTags.HTTP_URL]: ctx.request.href,
          [OpentracingTags.HTTP_METHOD]: ctx.request.method,
          [OpentracingTags.HTTP_STATUS_CODE]: ctx.response.status,
          [CustomHttpTags.HTTP_PATH]: ctx.request.path,
          [VTEXIncomingRequestTags.VTEX_REQUEST_ID]: ctx.get(REQUEST_ID_HEADER),
          [VTEXIncomingRequestTags.VTEX_WORKSPACE]: ctx.get(WORKSPACE_HEADER),
          [VTEXIncomingRequestTags.VTEX_ACCOUNT]: ctx.get(ACCOUNT_HEADER),
        })

        currentSpan.log(addPrefixOntoObjectKeys('req.headers', ctx.request.headers))
        currentSpan.log(addPrefixOntoObjectKeys('res.headers', ctx.response.headers))
        ctx.set(TRACE_ID_HEADER, traceInfo.traceId)
      }

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

export const traceUserLandRemainingPipelineMiddleware = () => {
  return async function traceUserLandRemainingPipeline(ctx: ServiceContext, next: () => Promise<void>) {
    const tracingCtx = ctx.tracing!
    ctx.tracing = undefined

    const span = tracingCtx.currentSpan
    const userLandTracer = ctx.vtex.tracer! as UserLandTracer
    userLandTracer.setFallbackSpan(span)
    userLandTracer.lockFallbackSpan()
    const startTime = process.hrtime()

    try {
      span.log({ event: RuntimeLogEvents.USER_MIDDLEWARES_START })
      await next()
    } catch (err) {
      ErrorReport.create({ originalError: err }).injectOnSpan(span, ctx.vtex.logger)
      throw err
    } finally {
      span.log({
        event: RuntimeLogEvents.USER_MIDDLEWARES_FINISH,
        [RuntimeLogFields.USER_MIDDLEWARES_DURATION]: hrToMillis(process.hrtime(startTime)),
      })
      ctx.tracing = tracingCtx
    }
  }
}
