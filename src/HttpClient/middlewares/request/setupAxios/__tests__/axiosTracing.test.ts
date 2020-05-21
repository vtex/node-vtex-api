import { getConfiguredAxios } from '..'
import { registerSharedTestSuite, TestSuiteConfig } from './axiosTracingTestSuite'
import { TestServer } from './TestServer'

const axios = getConfiguredAxios()

describe('Traces successfully on request and response success', () => {
  const testSuiteConfig: TestSuiteConfig = {
    axiosInstance: axios,
    expects: {
      numberOfRequestSpans: 1,
      statusCode: 200,
      totalOfSpans: 3,
    },
    requestsConfig: {
      url: '',
    },
  }

  beforeAll(async () => {
    testSuiteConfig.testServer = await TestServer.getAndStartTestServer()
    testSuiteConfig.requestsConfig.url = testSuiteConfig.testServer.getUrl()
  })

  afterAll(() => {
    return testSuiteConfig.testServer!.closeServer()
  })

  registerSharedTestSuite(testSuiteConfig)
})

describe('Traces successfully on response error', () => {
  const testSuiteConfig: TestSuiteConfig = {
    axiosInstance: axios,
    expects: {
      error: {
        errorMessagePrefix: 'Request failed with status code 400',
        isClientError: false,
      },
      numberOfRequestSpans: 1,
      statusCode: 400,
      totalOfSpans: 3,
    },
    requestsConfig: {
      url: '',
    },
  }

  beforeAll(async () => {
    testSuiteConfig.testServer = await TestServer.getAndStartTestServer()
    testSuiteConfig.requestsConfig.url = testSuiteConfig.testServer.getUrl()
    testSuiteConfig.testServer.setExpectFn((_, res) => {
      res.statusCode = 400
      res.statusMessage = 'Some status message'
      res.end(JSON.stringify({ error: 'Invincible error' }))
    })
  })

  afterAll(() => {
    return testSuiteConfig.testServer!.closeServer()
  })

  registerSharedTestSuite(testSuiteConfig)
})

describe('Traces successfully on request error (response is undefined)', () => {
  const testSuiteConfig: TestSuiteConfig = {
    axiosInstance: axios,
    expects: {
      error: {
        errorMessagePrefix: 'getaddrinfo',
        isClientError: true,
      },
      numberOfRequestSpans: 1,
      statusCode: undefined,
      totalOfSpans: 3,
    },
    requestsConfig: {
      url: 'http://invalidurl',
    },
  }

  registerSharedTestSuite(testSuiteConfig)
})

describe('Axios retries are traced independently - forcing ECONNREFUSED', () => {
  const testSuiteConfig: TestSuiteConfig = {
    axiosInstance: axios,
    expects: {
      error: {
        errorMessagePrefix: 'connect ECONNREFUSED 127.0.0.1:32123',
        isClientError: true,
      },
      numberOfRequestSpans: 4,
      statusCode: undefined,
      totalOfSpans: 6,
    },
    requestsConfig: {
      retries: 3,
      url: 'http://localhost:32123',
    },
  }

  registerSharedTestSuite(testSuiteConfig)
})

describe('Traces successfully and independently on response error with retries', () => {
  const testSuiteConfig: TestSuiteConfig = {
    axiosInstance: axios,
    expects: {
      error: {
        errorMessagePrefix: 'Request failed with status code 504',
        isClientError: false,
      },
      numberOfRequestSpans: 4,
      statusCode: 504,
      totalOfSpans: 6,
    },
    requestsConfig: {
      retries: 3,
      url: '',
    },
  }

  beforeAll(async () => {
    testSuiteConfig.testServer = await TestServer.getAndStartTestServer()
    testSuiteConfig.requestsConfig.url = testSuiteConfig.testServer.getUrl()
    testSuiteConfig.testServer.setExpectFn((_, res) => {
      res.statusCode = 504
      res.statusMessage = 'Some status message'
      res.end(JSON.stringify({ error: 'Gateway timeout' }))
    })
  })

  afterAll(() => {
    return testSuiteConfig.testServer!.closeServer()
  })

  registerSharedTestSuite(testSuiteConfig)
})
