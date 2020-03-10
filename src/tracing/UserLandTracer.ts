import { Span, SpanContext, SpanOptions, Tracer } from 'opentracing'

export interface IUserLandTracer {
  startSpan: Tracer['startSpan']
  inject: Tracer['inject']
}

export class UserLandTracer implements IUserLandTracer {
  private tracer: Tracer
  private fallbackSpan: Span
  private fallbackSpanLock: boolean

  constructor(tracer: Tracer, fallbackSpan: Span) {
    this.tracer = tracer
    this.fallbackSpan = fallbackSpan
    this.fallbackSpanLock = false
    
    this.inject = this.tracer.inject.bind(this.tracer)
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
}
