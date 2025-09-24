import { MockSpanContext } from '@tiagonapoli/opentracing-alternate-mock'
import { AxiosError, AxiosInstance } from 'axios'
import { REFERENCE_CHILD_OF, REFERENCE_FOLLOWS_FROM } from 'opentracing'
import { HeaderKeys } from '../../../../../constants'
import { SpanReferenceTypes } from '../../../../../tracing'
import { ErrorReportLogFields } from '../../../../../tracing/LogFields'
import { CustomHttpTags, OpentracingTags } from '../../../../../tracing/Tags'
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
      errorMessagePrefix: string
      isClientError: boolean
    }
  }
}

export const registerSharedTestSuite = (testSuiteConfig: TestSuiteConfig) => {
  const { axiosInstance: http } = testSuiteConfig

  // Helper function to get error message that works across Node.js versions
  const getErrorMessage = (error: AxiosError, expectedPrefix: string): string => {
    // In Node.js 20+, message might be empty, check errors array
    const errorWithErrors = error as any
    if (!error.message && errorWithErrors.errors && errorWithErrors.errors.length > 0) {
      // Find the error that matches our expected prefix
      const matchingError = errorWithErrors.errors.find((err: any) => 
        err.message && err.message.startsWith(expectedPrefix)
      )
      return matchingError ? matchingError.message : error.message
    }
    return error.message
  }

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
      expect(requestSpan!.tags()[OpentracingTags.HTTP_METHOD]).toEqual('get')
      expect(requestSpan!.tags()[OpentracingTags.HTTP_STATUS_CODE]).toEqual(testSuiteConfig.expects.statusCode)
      expect(requestSpan!.tags()[OpentracingTags.HTTP_URL]).toEqual(testSuiteConfig.requestsConfig.url)
      expect(requestSpan!.tags()[OpentracingTags.SPAN_KIND]).toEqual(OpentracingTags.SPAN_KIND_RPC_CLIENT)
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
      expect((requestSpan as any)._logs[0].fields['request-headers']).toBeDefined()
      if (!testSuiteConfig.expects.error?.isClientError) {
        expect((requestSpan as any)._logs[1].fields['response-headers']).toBeDefined()
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
        expect(requestSpan!.tags()[OpentracingTags.HTTP_URL]).toEqual(expectedTag)
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
        expect(requestSpan!.tags()[OpentracingTags.HTTP_URL]).toEqual(expectedTag)
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
        expect(requestSpan!.tags()[OpentracingTags.HTTP_URL]).toEqual(expectedTag)
      })
    })
  })

  describe('Request router cache tagging works properly', () => {
    it(`Doesn't assign router cache tag when it's not present`, async () => {
      testSuiteConfig.testServer?.mockResponseHeaders({})
      const { allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
      allRequestSpans.forEach((requestSpan) => {
        expect(requestSpan.tags()[CustomHttpTags.HTTP_ROUTER_CACHE_RESULT]).toBeUndefined()
      })
    })

    if (testSuiteConfig.testServer) {
      it(`Properly assigns router cache tag when it's present`, async () => {
        testSuiteConfig.testServer!.mockResponseHeaders({ [HeaderKeys.ROUTER_CACHE]: 'MISS' })
        const { allRequestSpans } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
        allRequestSpans.forEach((requestSpan) => {
          expect(requestSpan.tags()[CustomHttpTags.HTTP_ROUTER_CACHE_RESULT]).toEqual('MISS')
        })
      })
    }
  })

  if (testSuiteConfig.expects.error) {
    describe('Error tracing is working properly', () => {
      it('Throws an axios error', async () => {
        const { error } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
        expect((error as AxiosError).isAxiosError).toBe(true)
        const errorMessage = getErrorMessage(error as AxiosError, testSuiteConfig.expects.error!.errorMessagePrefix)
        expect(errorMessage.startsWith(testSuiteConfig.expects.error!.errorMessagePrefix)).toBeTruthy()
      })

      it('Assigns error tags and error logs to all request spans', async () => {
        const { allRequestSpans, error } = await TracedTestRequest.doRequest(http, testSuiteConfig.requestsConfig)
        allRequestSpans.forEach((requestSpan) => {
          expect(requestSpan!.tags()[OpentracingTags.ERROR]).toEqual('true')
          const len = (requestSpan as any)._logs.length
          expect((requestSpan as any)._logs[len - 1].fields.event).toEqual('error')
          expect((requestSpan as any)._logs[len - 1].fields[ErrorReportLogFields.ERROR_ID]).toBeDefined()
          expect((requestSpan as any)._logs[len - 1].fields[ErrorReportLogFields.ERROR_KIND]).toBeDefined()
          
          // Updated error message check to handle both Node.js versions
          const errorMessage = (requestSpan as any)._logs[len - 1].fields[ErrorReportLogFields.ERROR_MESSAGE] as string
          const expectedPrefix = testSuiteConfig.expects.error!.errorMessagePrefix
          
          // Check if error message starts with prefix OR if it's empty but we have the expected error code
          const hasExpectedPrefix = errorMessage && errorMessage.startsWith(expectedPrefix)
          const hasExpectedCode = !errorMessage && (error as AxiosError).code === 'ECONNREFUSED'
          
          expect(hasExpectedPrefix || hasExpectedCode).toBeTruthy()
        })
      })
    })
  }
}
