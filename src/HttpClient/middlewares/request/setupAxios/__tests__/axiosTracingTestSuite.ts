import { MockSpanContext } from '@tiagonapoli/opentracing-alternate-mock'
import { AxiosError, AxiosInstance } from 'axios'
import { REFERENCE_CHILD_OF, REFERENCE_FOLLOWS_FROM } from 'opentracing'
import { ROUTER_CACHE_HEADER } from '../../../../../constants'
import { SpanReferenceTypes } from '../../../../../tracing'
import { Tags } from '../../../../../tracing/Tags'
import { requestSpanPrefix } from '../interceptors/tracing'
import { TestServer } from './TestServer'
import { TracedTestRequest } from './TracedTestRequest'

export interface TestSuiteConfig {
  requestsConfig: {
    url: string
    retries?: number
    timeout?: number
  }
  axiosInstance: AxiosInstance
  testServer?: TestServer
  expects: {
    numberOfRequestSpans: number
    totalOfSpans: number
    statusCode: number | undefined
    error?: {
      errorMessage: string
      isClientError: boolean
    }
  }
}

export const registerSharedTestSuite = (testSuiteConfig: TestSuiteConfig) => {
  const { axiosInstance: http } = testSuiteConfig

  it('Creates the expected amount of spans', async () => {
    const { allRequestSpans, tracerReport } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
    expect(allRequestSpans.length).toBe(testSuiteConfig.expects.numberOfRequestSpans)
    expect(tracerReport?.spans.length).toBe(testSuiteConfig.expects.totalOfSpans)
  })

  it('Finishes all spans', async () => {
    const { tracerReport } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
    expect((tracerReport as any).unfinishedSpans.length).toBe(0)
  })

  describe('Tracing user options', () => {
    it('Specifies the referenceType with rootSpan as CHILD_OF if not assigned by the user', async () => {
      const { rootSpan, allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
      allRequestSpans.forEach((requestSpan) => {
        expect((requestSpan as any)._references.length).toEqual(1)
        expect((requestSpan as any)._references[0].type()).toEqual(REFERENCE_CHILD_OF)
        const fatherContext: MockSpanContext = (requestSpan as any)._references[0].referencedContext()
        expect(fatherContext.toTraceId()).toEqual(rootSpan.context().toTraceId())
        expect(fatherContext.toSpanId()).toEqual(rootSpan.context().toSpanId())
      })
    })

    it('Specifies the referenceType with rootSpan if requested', async () => {
      const { rootSpan, allRequestSpans } = await TracedTestRequest.doRequest(http, {
        ...testSuiteConfig.requestsConfig,
        tracing: { referenceType: SpanReferenceTypes.FOLLOWS_FROM },
      })

      allRequestSpans.forEach((requestSpan) => {
        expect((requestSpan as any)._references.length).toEqual(1)
        expect((requestSpan as any)._references[0].type()).toEqual(REFERENCE_FOLLOWS_FROM)
        const fatherContext: MockSpanContext = (requestSpan as any)._references[0].referencedContext()
        expect(fatherContext.toTraceId()).toEqual(rootSpan.context().toTraceId())
        expect(fatherContext.toSpanId()).toEqual(rootSpan.context().toSpanId())
      })
    })

    it('Correctly adds suffixes onto request span names if requested', async () => {
      const { allRequestSpans } = await TracedTestRequest.doRequest(http, {
        ...testSuiteConfig.requestsConfig,
        tracing: { requestSpanNameSuffix: 'suffix-test' },
      })

      allRequestSpans.forEach((requestSpan) => {
        expect(requestSpan.operationName()).toEqual(`${requestSpanPrefix}:suffix-test`)
      })
    })
  })

  it('Tags all request spans correctly', async () => {
    const { allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
    allRequestSpans.forEach((requestSpan) => {
      expect(requestSpan!.tags()[Tags.HTTP_METHOD]).toEqual('get')
      expect(requestSpan!.tags()[Tags.HTTP_STATUS_CODE]).toEqual(testSuiteConfig.expects.statusCode)
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(testSuiteConfig.requestsConfig.url)
      expect(requestSpan!.tags()[Tags.SPAN_KIND]).toEqual(Tags.SPAN_KIND_RPC_CLIENT)
    })
  })

  it('Injects the last spanContext created to the request', async () => {
    const req = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
    const requestAttempt = testSuiteConfig.expects.error ? req.error : req.res
    const { lastRequestSpan } = req
    expect(requestAttempt.request.getHeader('span-id')).toBeDefined()
    expect(requestAttempt.request.getHeader('span-id')).toEqual(lastRequestSpan!.uuid())
  })

  it('Logs request information into the spans', async () => {
    const { allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
    let expectedLen = 2
    if (testSuiteConfig.expects.error && !testSuiteConfig.expects.error.isClientError) {
      expectedLen = 3
    }

    allRequestSpans.forEach((requestSpan) => {
      expect((requestSpan as any)._logs.length).toEqual(expectedLen)
      expect((requestSpan as any)._logs[0].fields.event).toEqual('request-headers')
      if (!testSuiteConfig.expects.error?.isClientError) {
        expect((requestSpan as any)._logs[1].fields.event).toEqual('response-headers')
      }
    })
  })

  describe('Trace tags are correct when using complex URLs', () => {
    it('Tags correctly when using params', async () => {
      const { allRequestSpans } = await TracedTestRequest.doRequest(http, {
        ...testSuiteConfig.requestsConfig,
        params: { a: 1, b: 2 },
      })

      const expectedTag = `${testSuiteConfig.requestsConfig.url}?a=1&b=2`
      allRequestSpans.forEach((requestSpan) => {
        expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(expectedTag)
      })
    })

    it('Tags correctly when baseURL is set', async () => {
      const { allRequestSpans } = await TracedTestRequest.doRequest(http, {
        ...testSuiteConfig.requestsConfig,
        baseURL: `${testSuiteConfig.requestsConfig.url}/api`,
        url: '/asd',
      })

      const expectedTag = `${testSuiteConfig.requestsConfig.url}/api/asd`
      allRequestSpans.forEach((requestSpan) => {
        expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(expectedTag)
      })
    })

    it('Tags correctly when baseURL and params are set', async () => {
      const { allRequestSpans } = await TracedTestRequest.doRequest(http, {
        ...testSuiteConfig.requestsConfig,
        baseURL: `${testSuiteConfig.requestsConfig.url}/api`,
        params: { a: 1, b: 2 },
        url: '/asd',
      })

      const expectedTag = `${testSuiteConfig.requestsConfig.url}/api/asd?a=1&b=2`
      allRequestSpans.forEach((requestSpan) => {
        expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(expectedTag)
      })
    })
  })

  describe('Request router cache tagging works properly', () => {
    it(`Doesn't assign router cache tag when it's not present`, async () => {
      testSuiteConfig.testServer?.mockResponseHeaders({})
      const { allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
      allRequestSpans.forEach((requestSpan) => {
        expect(requestSpan.tags()[Tags.HTTP_ROUTER_CACHE]).toBeUndefined()
      })
    })

    if (testSuiteConfig.testServer) {
      it(`Properly assigns router cache tag when it's present`, async () => {
        testSuiteConfig.testServer!.mockResponseHeaders({ [ROUTER_CACHE_HEADER]: 'MISS' })
        const { allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
        allRequestSpans.forEach((requestSpan) => {
          expect(requestSpan.tags()[Tags.HTTP_ROUTER_CACHE]).toEqual('MISS')
        })
      })
    }
  })

  if (testSuiteConfig.expects.error) {
    describe('Error tracing is working properly', () => {
      it('Throws an axios error', async () => {
        const { error } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
        expect((error as AxiosError).isAxiosError).toBe(true)
        expect((error as AxiosError).message).toEqual(testSuiteConfig.expects.error!.errorMessage)
      })

      it('Assigns error tags and error logs to all request spans', async () => {
        const { allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
        allRequestSpans.forEach((requestSpan) => {
          expect(requestSpan!.tags()[Tags.ERROR]).toEqual('true')
          const len = (requestSpan as any)._logs.length
          expect((requestSpan as any)._logs[len - 1].fields.event).toEqual('error')
          expect((requestSpan as any)._logs[len - 1].fields.stack).toBeDefined()
          expect((requestSpan as any)._logs[len - 1].fields.message).toEqual(
            testSuiteConfig.expects.error!.errorMessage
          )
        })
      })
    })
  }
}
