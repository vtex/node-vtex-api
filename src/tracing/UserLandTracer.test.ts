import { MockSpan, MockTracer } from '@tiagonapoli/opentracing-alternate-mock'

import { GraphQLTags } from './Tags'
import { UserLandTracer } from './UserLandTracer'

describe('UserLandTracer.setFallbackSpanTag', () => {
  test('writes a tag only to the fallback span', () => {
    const tracer = new MockTracer()
    const fallback = tracer.startSpan('incoming-request') as MockSpan
    const userLandTracer = new UserLandTracer(tracer, fallback)

    userLandTracer.setFallbackSpanTag(
      GraphQLTags.GRAPHQL_OPERATION_NAME,
      'GetProduct'
    )
    const child = userLandTracer.startSpan('child') as MockSpan

    expect(fallback.tags()).toHaveProperty(
      [GraphQLTags.GRAPHQL_OPERATION_NAME],
      'GetProduct'
    )
    expect(child.tags()).not.toHaveProperty(
      [GraphQLTags.GRAPHQL_OPERATION_NAME]
    )
  })

  test('is a no-op when there is no fallback span', () => {
    const userLandTracer = new UserLandTracer(new MockTracer())

    expect(() => {
      userLandTracer.setFallbackSpanTag(
        GraphQLTags.GRAPHQL_OPERATION_TYPE,
        'query'
      )
    }).not.toThrow()
  })

  test('can write after the fallback span is locked', () => {
    const tracer = new MockTracer()
    const fallback = tracer.startSpan('incoming-request') as MockSpan
    const replacement = tracer.startSpan('replacement') as MockSpan
    const userLandTracer = new UserLandTracer(tracer, fallback)

    userLandTracer.lockFallbackSpan()

    expect(() => userLandTracer.setFallbackSpan(replacement)).toThrow(
      "FallbackSpan is locked, can't change it"
    )
    expect(() => {
      userLandTracer.setFallbackSpanTag(
        GraphQLTags.GRAPHQL_OPERATION_TYPE,
        'query'
      )
    }).not.toThrow()
    expect(fallback.tags()).toHaveProperty(
      [GraphQLTags.GRAPHQL_OPERATION_TYPE],
      'query'
    )
    expect(replacement.tags()).not.toHaveProperty(
      [GraphQLTags.GRAPHQL_OPERATION_TYPE]
    )
  })
})
