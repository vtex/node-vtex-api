import { Span, SpanContext, SpanOptions, Tracer } from 'opentracing'

export interface IUserLandTracer {
  startSpan: Tracer['startSpan']
  inject: Tracer['inject']
  fallbackSpanContext: () => SpanContext
}

export class UserLandTracer implements IUserLandTracer {
  private tracer: Tracer
  private fallbackSpan: Span
  private fallbackSpanLock: boolean

  constructor(tracer: Tracer, fallbackSpan: Span) {
    this.tracer = tracer
    this.fallbackSpan = fallbackSpan
    this.fallbackSpanLock = false
  }

  public lockFallbackSpan() {
    this.fallbackSpanLock = true
  }

  public setFallbackSpan(newSpan: Span) {
    if(this.fallbackSpanLock) {
      throw new Error(`FallbackSpan is locked, can't change it`)
    }

    this.fallbackSpan = newSpan
  }

  public startSpan(name: string, options: SpanOptions = {}) {
    if(!options.childOf) {
        return this.tracer.startSpan(name, { ...options, childOf: this.fallbackSpan })
    }
    return this.tracer.startSpan(name, options)
  }

  public inject(spanContext: SpanContext | Span, format: string, carrier: any) {
    return this.tracer.inject(spanContext, format, carrier)
  }

  public fallbackSpanContext(): SpanContext {
    return this.fallbackSpan.context()
  }
}
