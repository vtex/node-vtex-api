import { Span } from 'opentracing'

export interface TraceInfo {
  traceId: string
  isSampled: boolean
}

export function getTraceInfo(span: Span): TraceInfo {
  const spanContext = span.context()
  return {
    isSampled: (spanContext as any).isSampled?.() ?? false,
    traceId: spanContext.toTraceId(),
  }
}
