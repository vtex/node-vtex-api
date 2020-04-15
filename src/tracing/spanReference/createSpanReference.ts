import { Reference, REFERENCE_CHILD_OF, REFERENCE_FOLLOWS_FROM, Span } from 'opentracing'
import { SpanReferenceTypes } from './SpanReferenceTypes'

export function createSpanReference(span: Span, type: SpanReferenceTypes) {
  return new Reference(
    type === SpanReferenceTypes.CHILD_OF ? REFERENCE_CHILD_OF : REFERENCE_FOLLOWS_FROM,
    span.context()
  )
}
