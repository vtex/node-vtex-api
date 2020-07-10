import { FORMAT_HTTP_HEADERS, SpanContext, Tracer } from 'opentracing'
import { finished as onStreamFinished } from 'stream'
import { ACCOUNT_HEADER, REQUEST_ID_HEADER, TRACE_ID_HEADER, WORKSPACE_HEADER } from '../../constants'
import { ErrorReport, getTraceInfo } from '../../tracing'
import { RuntimeLogEvents } from '../../tracing/LogEvents'
import { RuntimeLogFields } from '../../tracing/LogFields'
import { CustomHttpTags, OpentracingTags, VTEXIncomingRequestTags } from '../../tracing/Tags'
import { UserLandTracer } from '../../tracing/UserLandTracer'
import { hrToMillis, hrToMillisFloat } from '../../utils'
import { addPrefixOntoObjectKeys } from '../../utils/addPrefixOntoObjectKeys'
import { ServiceContext } from '../worker/runtime/typings'
import {
  createConcurrentRequestsInstrument,
  createRequestsResponseSizesInstrument,
  createRequestsTimingsInstrument,
  createTotalAbortedRequestsInstrument,
  createTotalRequestsInstrument,
  MetricLabels,
} from './metrics'

const PATHS_BLACKLISTED_FOR_TRACING = ['/metrics', '/_status', '/healthcheck']

export const addTracingMiddleware = (tracer: Tracer) => {
  const concurrentRequests = createConcurrentRequestsInstrument()
  const requestTimings = createRequestsTimingsInstrument()
  const totalRequests = createTotalRequestsInstrument()
  const responseSizes = createRequestsResponseSizesInstrument()
  const abortedRequests = createTotalAbortedRequestsInstrument()

  return async function addTracing(ctx: ServiceContext, next: () => Promise<void>) {
    const start = process.hrtime()
    concurrentRequests.inc(1)

    if (PATHS_BLACKLISTED_FOR_TRACING.includes(ctx.request.path)) {
      await next()
      concurrentRequests.dec(1)
      return
    }

    const rootSpan = tracer.extract(FORMAT_HTTP_HEADERS, ctx.request.headers) as undefined | SpanContext
    const currentSpan = tracer.startSpan('unknown-operation', {
      childOf: rootSpan,
      tags: { [OpentracingTags.SPAN_KIND]: OpentracingTags.SPAN_KIND_RPC_SERVER },
    })

    const initialSamplingDecision = getTraceInfo(currentSpan).isSampled

    ctx.tracing = { currentSpan, tracer }
    ctx.req.once('aborted', () =>
      abortedRequests.inc({ [MetricLabels.REQUEST_HANDLER]: (currentSpan as any).operationName as string }, 1)
    )

    let responseClosed = false
    ctx.res.once('close', () => (responseClosed = true))

    try {
      await next()
    } catch (err) {
      ErrorReport.create({ originalError: err }).injectOnSpan(currentSpan, ctx.vtex?.logger)
      throw err
    } finally {
      const responseLength = ctx.response.length
      if (responseLength) {
        responseSizes.observe(
          { [MetricLabels.REQUEST_HANDLER]: (currentSpan as any).operationName as string },
          responseLength
        )
      }

      totalRequests.inc(
        {
          [MetricLabels.REQUEST_HANDLER]: (currentSpan as any).operationName as string,
          [MetricLabels.STATUS_CODE]: ctx.response.status,
        },
        1
      )

      const traceInfo = getTraceInfo(currentSpan)
      if (traceInfo.isSampled) {
        if (!initialSamplingDecision) {
          currentSpan.setTag(OpentracingTags.SPAN_KIND, OpentracingTags.SPAN_KIND_RPC_SERVER)
        }

        currentSpan.addTags({
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

      const onResFinished = () => {
        requestTimings.observe(
          {
            [MetricLabels.REQUEST_HANDLER]: (currentSpan as any).operationName as string,
          },
          hrToMillisFloat(process.hrtime(start))
        )

        concurrentRequests.dec(1)
        currentSpan.finish()
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
