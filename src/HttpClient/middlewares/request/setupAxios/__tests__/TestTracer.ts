import { MockSpan, MockTracer } from '@tiagonapoli/opentracing-alternate-mock'
import { Span, SpanContext, SpanOptions } from 'opentracing'
import { IUserLandTracer } from '../../../../../tracing'

export class TestTracer implements IUserLandTracer {
  public fallbackSpan: MockSpan
  public mockTracer: MockTracer

  constructor() {
    this.mockTracer = new MockTracer()
    this.fallbackSpan = this.mockTracer.startSpan('fallback-span') as MockSpan
    this.fallbackSpan.finish()
  }

  public startSpan(name: string, options?: SpanOptions) {
    return this.mockTracer.startSpan(name, options)
  }

  public inject(spanContext: Span | SpanContext, format: string, carrier: any) {
    return this.mockTracer.inject(spanContext, format, carrier)
  }

  public fallbackSpanContext() {
    return this.fallbackSpan.context()
  }
}
