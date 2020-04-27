import { FORMAT_HTTP_HEADERS, Span, SpanContext, SpanOptions, Tracer } from 'opentracing'
import { TracerSingleton } from '../service/tracing/TracerSingleton'

export interface IUserLandTracer {
  traceId: string
  isTraceSampled: boolean
  startSpan: Tracer['startSpan']
  inject: Tracer['inject']
  fallbackSpanContext: () => SpanContext
}

export const createTracingContextFromCarrier = (
  newSpanName: string,
  carrier: Record<string, any>
): { span: Span; tracer: IUserLandTracer } => {
  const tracer = TracerSingleton.getTracer()
  const rootSpan = tracer.extract(FORMAT_HTTP_HEADERS, carrier) as SpanContext | undefined
  if (rootSpan == null) {
    throw new Error('Missing span context data on carrier')
  }

  const span = tracer.startSpan(newSpanName, { childOf: rootSpan })
  const userlandTracer = new UserLandTracer(tracer, span)
  userlandTracer.lockFallbackSpan()
  return { span, tracer: userlandTracer }
}

export class UserLandTracer implements IUserLandTracer {
  private tracer: Tracer
  private fallbackSpan: Span
  private fallbackSpanLock: boolean

  private _isSampled: boolean
  private _traceId: string

  constructor(tracer: Tracer, fallbackSpan: Span) {
    this.tracer = tracer
    this.fallbackSpan = fallbackSpan
    this.fallbackSpanLock = false

    const spanContext = fallbackSpan.context()
    this._traceId = spanContext.toTraceId()
    this._isSampled = (spanContext as any)?.isSampled()
  }

  get traceId() {
    return this._traceId
  }

  get isTraceSampled() {
    return this._isSampled
  }

  public lockFallbackSpan() {
    this.fallbackSpanLock = true
  }

  public setFallbackSpan(newSpan: Span) {
    if (this.fallbackSpanLock) {
      throw new Error(`FallbackSpan is locked, can't change it`)
    }

    this.fallbackSpan = newSpan
  }

  public startSpan(name: string, options?: SpanOptions) {
    if (options && (options.childOf || options.references?.length)) {
      return this.tracer.startSpan(name, options)
    }

    return this.tracer.startSpan(name, { ...options, childOf: this.fallbackSpan })
  }

  public inject(spanContext: SpanContext | Span, format: string, carrier: any) {
    return this.tracer.inject(spanContext, format, carrier)
  }

  public fallbackSpanContext(): SpanContext {
    return this.fallbackSpan.context()
  }
}
