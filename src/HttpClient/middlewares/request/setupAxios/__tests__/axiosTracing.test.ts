import { AxiosError } from 'axios'
import { getConfiguredAxios } from '..'
import { ROUTER_CACHE_HEADER } from '../../../../../constants'
import { Tags } from '../../../../../tracing/Tags'
import { TestServer } from './TestServer'
import { TracedTestRequest } from './TracedTestRequest'

const { http: axios } = getConfiguredAxios()
describe('Traces successfully on request and response success', () => {
  let testServer: TestServer
  beforeAll(async () => {
    testServer = await TestServer.getAndStartTestServer()
  })

  afterAll(async () => {
    await testServer.closeServer()
  })

  it('Creates the expected amount of spans', async () => {
    const { allRequestSpans, tracerReport } = await testServer.doRequest(axios)
    expect(allRequestSpans?.length).toBe(1)
    expect(tracerReport?.spans.length).toBe(2)
  })

  it('Finishes all spans', async () => {
    const { tracerReport } = await testServer.doRequest(axios)
    expect((tracerReport as any).unfinishedSpans.length).toBe(0)
  })

  it('Creates the request span', async () => {
    const { requestSpan } = await testServer.doRequest(axios)
    expect(requestSpan).toBeDefined()
  })

  it('Tags the request span correctly', async () => {
    const { requestSpan, url } = await testServer.doRequest(axios)
    expect(requestSpan!.tags()[Tags.HTTP_METHOD]).toEqual('get')
    expect(requestSpan!.tags()[Tags.HTTP_STATUS_CODE]).toEqual(200)
    expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(url)
    expect(requestSpan!.tags()[Tags.SPAN_KIND]).toEqual(Tags.SPAN_KIND_RPC_CLIENT)
  })

  it('Injects the spanContext to the request', async () => {
    const { res, requestSpan } = await testServer.doRequest(axios)
    expect(res.request.getHeader('span-id')).toEqual(requestSpan!.uuid())
  })

  it(`Doesn't assign router cache tag when it's not present`, async () => {
    testServer.mockResponseHeaders({})
    const { requestSpan } = await testServer.doRequest(axios)
    expect(requestSpan!.tags()[Tags.HTTP_ROUTER_CACHE]).toBeUndefined()
  })

  it(`Properly assigns router cache tag when it's present`, async () => {
    testServer.mockResponseHeaders({ [ROUTER_CACHE_HEADER]: 'MISS' })
    const { requestSpan } = await testServer.doRequest(axios)
    expect(requestSpan!.tags()[Tags.HTTP_ROUTER_CACHE]).toEqual('MISS')
  })

  describe('Trace tags are correct when using complex URLs', () => {
    it('Tags correctly when using params', async () => {
      const { requestSpan } = await testServer.doRequest(axios, { params: { a: 1, b: 2 } })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`${testServer.getUrl()}?a=1&b=2`)
    })

    it('Tags correctly when baseURL is set', async () => {
      const { requestSpan } = await TracedTestRequest.doRequest(axios, {
        baseURL: `${testServer.getUrl('/api')}`,
        url: '/asd',
      })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`${testServer.getUrl()}/api/asd`)
    })

    it('Tags correctly when baseURL and params are set', async () => {
      const { requestSpan } = await TracedTestRequest.doRequest(axios, {
        baseURL: `${testServer.getUrl('/api')}`,
        params: { a: 1, b: 2 },
        url: '/asd',
      })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`${testServer.getUrl()}/api/asd?a=1&b=2`)
    })
  })
})

describe('Traces successfully on response error', () => {
  let testServer: TestServer
  beforeAll(async () => {
    testServer = await TestServer.getAndStartTestServer()
    testServer.setExpectFn((_, res) => {
      res.statusCode = 400
      res.statusMessage = 'Some status message'
      res.end(JSON.stringify({ error: 'Invincible error' }))
    })
  })

  afterAll(() => {
    return testServer.closeServer()
  })

  it('Creates the expected amount of spans', async () => {
    const { allRequestSpans, tracerReport } = await testServer.doRequest(axios)
    expect(allRequestSpans?.length).toBe(1)
    expect(tracerReport?.spans.length).toBe(2)
  })

  it('Throws an axios error', async () => {
    const { error } = await testServer.doRequest(axios)
    expect((error as AxiosError).isAxiosError).toBe(true)
  })

  it('Finishes all spans', async () => {
    const { tracerReport } = await testServer.doRequest(axios)
    expect((tracerReport as any).unfinishedSpans.length).toBe(0)
  })

  it('Creates the request span', async () => {
    const { requestSpan } = await testServer.doRequest(axios)
    expect(requestSpan).toBeDefined()
  })

  it('Tags the request span correctly', async () => {
    const { requestSpan, url } = await testServer.doRequest(axios)
    expect(requestSpan!.tags()[Tags.HTTP_METHOD]).toEqual('get')
    expect(requestSpan!.tags()[Tags.HTTP_STATUS_CODE]).toEqual(400)
    expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(url)
    expect(requestSpan!.tags()[Tags.SPAN_KIND]).toEqual(Tags.SPAN_KIND_RPC_CLIENT)
  })

  it('Assigns error tags and error logs to the request span', async () => {
    const { requestSpan } = await testServer.doRequest(axios)
    expect(requestSpan!.tags()[Tags.ERROR]).toEqual('true')
    expect((requestSpan as any)._logs.length).toEqual(3)
    expect((requestSpan as any)._logs[2].fields.stack).toBeDefined()
    expect((requestSpan as any)._logs[2].fields.message).toEqual('Request failed with status code 400')
  })

  it('Injects the spanContext to the request', async () => {
    const { error, requestSpan } = await testServer.doRequest(axios)
    expect(error.request.getHeader('span-id')).toEqual(requestSpan!.uuid())
  })

  it(`Doesn't assign router cache tag when it's not present`, async () => {
    testServer.mockResponseHeaders({})
    const { requestSpan } = await testServer.doRequest(axios)
    expect(requestSpan!.tags()[Tags.HTTP_ROUTER_CACHE]).toBeUndefined()
  })

  it(`Properly assigns router cache tag when it's present`, async () => {
    testServer.mockResponseHeaders({ [ROUTER_CACHE_HEADER]: 'MISS' })
    const { requestSpan } = await testServer.doRequest(axios)
    expect(requestSpan!.tags()[Tags.HTTP_ROUTER_CACHE]).toEqual('MISS')
  })

  describe('Trace tags are correct when using complex URLs', () => {
    it('Tags correctly when using params', async () => {
      const { requestSpan } = await testServer.doRequest(axios, { params: { a: 1, b: 2 } })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`${testServer.getUrl()}?a=1&b=2`)
    })

    it('Tags correctly when baseURL is set', async () => {
      const { requestSpan } = await TracedTestRequest.doRequest(axios, {
        baseURL: `${testServer.getUrl('/api')}`,
        url: '/asd',
      })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`${testServer.getUrl()}/api/asd`)
    })

    it('Tags correctly when baseURL and params are set', async () => {
      const { requestSpan } = await TracedTestRequest.doRequest(axios, {
        baseURL: `${testServer.getUrl('/api')}`,
        params: { a: 1, b: 2 },
        url: '/asd',
      })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`${testServer.getUrl()}/api/asd?a=1&b=2`)
    })
  })
})

describe('Traces successfully on request error (response is undefined)', () => {
  const url = 'http://invalidurl'

  it('Creates the expected amount of spans', async () => {
    const { allRequestSpans, tracerReport } = await TracedTestRequest.doRequest(axios, { url })
    expect(allRequestSpans?.length).toBe(1)
    expect(tracerReport?.spans.length).toBe(2)
  })

  it('Throws an axios error', async () => {
    const { error } = await TracedTestRequest.doRequest(axios, { url })
    expect((error as AxiosError).isAxiosError).toBe(true)
  })

  it('Finishes all spans', async () => {
    const { tracerReport } = await TracedTestRequest.doRequest(axios, { url })
    expect((tracerReport as any).unfinishedSpans.length).toBe(0)
  })

  it('Creates the request span', async () => {
    const { requestSpan } = await TracedTestRequest.doRequest(axios, { url })
    expect(requestSpan).toBeDefined()
  })

  it('Tags the request span correctly', async () => {
    const { requestSpan } = await TracedTestRequest.doRequest(axios, { url })
    expect(requestSpan!.tags()[Tags.HTTP_METHOD]).toEqual('get')
    expect(requestSpan!.tags()[Tags.HTTP_STATUS_CODE]).toBeUndefined()
    expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(url)
    expect(requestSpan!.tags()[Tags.SPAN_KIND]).toEqual(Tags.SPAN_KIND_RPC_CLIENT)
  })

  it('Assigns error tags and error logs to the request span', async () => {
    const { requestSpan } = await TracedTestRequest.doRequest(axios, { url })
    expect(requestSpan!.tags()[Tags.ERROR]).toEqual('true')
    expect((requestSpan as any)._logs.length).toEqual(2)
    expect((requestSpan as any)._logs[1].fields.stack).toBeDefined()
    expect((requestSpan as any)._logs[1].fields.message).toEqual('getaddrinfo EAI_AGAIN invalidurl')
  })

  it('Injects the spanContext to the request', async () => {
    const { error, requestSpan } = await TracedTestRequest.doRequest(axios, {
      url,
    })
    expect(error.request.getHeader('span-id')).toEqual(requestSpan!.uuid())
  })

  it('Does not assign router cache tag', async () => {
    const { requestSpan } = await TracedTestRequest.doRequest(axios, { url })
    expect(requestSpan!.tags()[Tags.HTTP_ROUTER_CACHE]).toBeUndefined()
  })

  describe('Trace tags are correct when using complex URLs', () => {
    it('Tags correctly when using params', async () => {
      const { requestSpan } = await TracedTestRequest.doRequest(axios, { url, params: { a: 1, b: 2 } })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`${url}?a=1&b=2`)
    })

    it('Tags correctly when baseURL is set', async () => {
      const { requestSpan } = await TracedTestRequest.doRequest(axios, {
        baseURL: `http://invalidurl`,
        url: '/asd',
      })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`http://invalidurl/asd`)
    })

    it('Tags correctly when baseURL and params are set', async () => {
      const { requestSpan } = await TracedTestRequest.doRequest(axios, {
        baseURL: `http://invalidurl`,
        params: { a: 1, b: 2 },
        url: '/asd',
      })
      expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(`http://invalidurl/asd?a=1&b=2`)
    })
  })
})

describe('Axios retries are traced independently - forcing ECONNREFUSED', () => {
  const RETRIES = 2

  let requestConfig: any
  beforeAll(async () => {
    requestConfig = { url: `http://localhost:32123`, retries: RETRIES, timeout: 50 }
  })

  it('Creates one requestSpan for each retry', async () => {
    const { tracerReport, allRequestSpans } = await TracedTestRequest.doRequest(axios, requestConfig)
    expect(allRequestSpans?.length).toBe(RETRIES + 1)
    expect(tracerReport?.spans.length).toBe(RETRIES + 2)
  })

  it('Throws an axios error', async () => {
    const { error } = await TracedTestRequest.doRequest(axios, requestConfig)
    expect((error as AxiosError).isAxiosError).toBe(true)
  })

  it('Finishes all spans', async () => {
    const { tracerReport } = await TracedTestRequest.doRequest(axios, requestConfig)
    expect((tracerReport as any).unfinishedSpans.length).toBe(0)
  })

  it('Creates the request span', async () => {
    const { requestSpan } = await TracedTestRequest.doRequest(axios, requestConfig)
    expect(requestSpan).toBeDefined()
  })

  it('Tags the request span correctly', async () => {
    const { requestSpan, url } = await TracedTestRequest.doRequest(axios, requestConfig)
    expect(requestSpan!.tags()[Tags.HTTP_METHOD]).toEqual('get')
    expect(requestSpan!.tags()[Tags.HTTP_STATUS_CODE]).toBeUndefined()
    expect(requestSpan!.tags()[Tags.HTTP_URL]).toEqual(url)
    expect(requestSpan!.tags()[Tags.SPAN_KIND]).toEqual(Tags.SPAN_KIND_RPC_CLIENT)
  })

  it('Assigns error tags and error logs to the request span', async () => {
    const { requestSpan } = await TracedTestRequest.doRequest(axios, requestConfig)
    expect(requestSpan!.tags()[Tags.ERROR]).toEqual('true')
    expect((requestSpan as any)._logs.length).toEqual(2)
    expect((requestSpan as any)._logs[1].fields.stack).toBeDefined()
    expect((requestSpan as any)._logs[1].fields.message).toContain(`connect ECONNREFUSED 127.0.0.1:`)
  })

  it('Injects to the request the last spanContext created', async () => {
    const { error, allRequestSpans } = await TracedTestRequest.doRequest(axios, requestConfig)
    expect(error.request.getHeader('span-id')).toEqual(allRequestSpans![allRequestSpans!.length - 1].uuid())
  })
})
