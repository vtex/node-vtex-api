import { FORMAT_HTTP_HEADERS, Span } from 'opentracing'

export { ErrorKindsBase as ErrorKinds } from '@vtex/node-error-report'
export { ErrorReport } from './errorReporting/ErrorReport'
export {
  CallerTracingConfig,
  TracingContext,
  tracingInstrumentAsyncFn,
  TracingInstrumentationOptions,
  tracingInstrumentSyncFn,
} from './instrumentationHelpers/wrappers'
export { createSpanReference } from './spanReference/createSpanReference'
export { SpanReferenceTypes } from './spanReference/SpanReferenceTypes'
export { USERLAND_TAGS as TracingTags } from './Tags'
export { createTracingContextFromCarrier, IUserLandTracer } from './UserLandTracer'
export { getTraceInfo, TraceInfo } from './utils'
export { Span, FORMAT_HTTP_HEADERS }
