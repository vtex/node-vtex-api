import { FORMAT_HTTP_HEADERS, MockTracer } from 'opentracing'
import { MockContext } from 'opentracing/lib/mock_tracer'

export class CustomMockTracer extends MockTracer {
  // @ts-ignore
  protected _inject(spanContext: MockContext, format: any, carrier: any) {
    if (format === FORMAT_HTTP_HEADERS) {
      carrier['span-id'] = spanContext.span().uuid()
    }
  }
}
