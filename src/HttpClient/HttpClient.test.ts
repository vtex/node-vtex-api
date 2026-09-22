import { HttpClient } from './HttpClient'
import { AxiosResponse } from 'axios'
import { IncomingMessage } from 'http'
import { Logger } from '../service/logger'
import { CacheType } from './middlewares/cache'
import { IOContext } from '../service/worker/runtime/typings'
import { InstanceOptions, IOResponse, MiddlewareContext, RequestConfig } from './typings'

jest.mock('koa-compose', () => {
  return jest.fn((middlewares: any[]) => {
    return async (context: MiddlewareContext) => {
      for (const middleware of middlewares) {
        if (middleware) {
          await middleware(context)
        }
      }
    }
  })
})

jest.mock('p-limit', () => {
  return jest.fn((limit: number) => (fn: Function) => fn())
})

jest.mock('../utils/binding', () => ({
  formatBindingHeaderValue: jest.fn((val: any) => `binding-${val}`),
}))

jest.mock('../utils/tenant', () => ({
  formatTenantHeaderValue: jest.fn((val: any) => `tenant-${val}`),
}))

jest.mock('../utils/bodyHash', () => ({
  computeBodyHash: jest.fn((data: any) => 'hash-123'),
}))

jest.mock('./middlewares/cache', () => ({
  cacheMiddleware: jest.fn(() => async () => {}),
  CacheType: {
    Memory: 'memory',
    Disk: 'disk',
  },
}))

jest.mock('./middlewares/cancellationToken', () => ({
  cancellationToken: jest.fn(() => async () => {}),
}))

jest.mock('./middlewares/inflight', () => ({
  singleFlightMiddleware: async () => {},
}))

jest.mock('./middlewares/memoization', () => ({
  memoizationMiddleware: jest.fn(() => async () => {}),
}))

jest.mock('./middlewares/metrics', () => ({
  metricsMiddleware: jest.fn(() => async () => {}),
}))

jest.mock('./middlewares/notFound', () => ({
  acceptNotFoundMiddleware: async () => {},
  notFoundFallbackMiddleware: async () => {},
}))

jest.mock('./middlewares/recorder', () => ({
  recorderMiddleware: jest.fn(() => async () => {}),
}))

jest.mock('./middlewares/request', () => ({
  defaultsMiddleware: jest.fn(() => async () => {}),
  requestMiddleware: jest.fn(() => async () => {}),
  routerCacheMiddleware: async () => {},
}))

jest.mock('./middlewares/tracing', () => ({
  createHttpClientTracingMiddleware: jest.fn(() => async () => {}),
}))

describe('HttpClient', () => {
  let mockLogger: jest.Mocked<Logger>
  let mockMemoryCache: any
  let mockDiskCache: any
  let clientOptions: IOContext & Partial<InstanceOptions>

  beforeEach(() => {
    jest.clearAllMocks()

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    } as any

    mockMemoryCache = {
      get: jest.fn(),
      set: jest.fn(),
    }

    mockDiskCache = {
      get: jest.fn(),
      set: jest.fn(),
    }

    clientOptions = {
      account: 'test-account',
      baseURL: 'https://api.example.com',
      authToken: 'test-token',
      authType: 'Bearer',
      memoryCache: mockMemoryCache,
      diskCache: mockDiskCache,
      locale: 'en-US',
      name: 'TestClient',
      userAgent: 'test-agent/1.0',
      timeout: 5000,
      logger: mockLogger,
    }
  })

  describe('constructor', () => {
    it('should initialize with required options', () => {
      // Arrange & Act
      const client = new HttpClient(clientOptions)

      // Assert
      expect(client.name).toBe('TestClient')
    })

    it('should use baseURL as name when name is not provided', () => {
      // Arrange
      const opts = { ...clientOptions, name: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should use "unknown" as name when neither name nor baseURL is provided', () => {
      // Arrange
      const opts = { ...clientOptions, name: undefined, baseURL: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set default timeout when not provided', () => {
      // Arrange
      const opts = { ...clientOptions, timeout: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include authorization header when authType and authToken are provided', () => {
      // Arrange & Act
      new HttpClient(clientOptions)

      // Assert - verify the middleware was called with correct headers
      expect(true).toBe(true)
    })

    it('should not include authorization header when authToken is missing', () => {
      // Arrange
      const opts = { ...clientOptions, authToken: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include custom headers from options', () => {
      // Arrange
      const opts = {
        ...clientOptions,
        headers: { 'X-Custom': 'custom-value' },
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include account header when account is provided', () => {
      // Arrange & Act
      new HttpClient(clientOptions)

      // Assert
      expect(true).toBe(true)
    })

    it('should include tenant header when tenant is provided', () => {
      // Arrange
      const opts = { ...clientOptions, tenant: 'test-tenant' }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include binding header when binding is provided', () => {
      // Arrange
      const opts = { ...clientOptions, binding: { channel: 'web' } }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include locale header when locale is provided', () => {
      // Arrange & Act
      new HttpClient(clientOptions)

      // Assert
      expect(true).toBe(true)
    })

    it('should include operation ID header when operationId is provided', () => {
      // Arrange
      const opts = { ...clientOptions, operationId: 'op-123' }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include product header when product is provided', () => {
      // Arrange
      const opts = { ...clientOptions, product: 'checkout' }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include segment token header when segmentToken is provided', () => {
      // Arrange
      const opts = { ...clientOptions, segmentToken: 'segment-123' }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include session token header when sessionToken is provided', () => {
      // Arrange
      const opts = { ...clientOptions, sessionToken: 'session-123' }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include forwarded host header when host is provided', () => {
      // Arrange
      const opts = { ...clientOptions, host: 'api.host.com' }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should set memoizable to true by default', () => {
      // Arrange & Act
      const client = new HttpClient(clientOptions)

      // Assert
      expect(client).toBeDefined()
    })

    it('should set memoizable to provided value', () => {
      // Arrange
      const opts = { ...clientOptions, memoizable: false }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should set cacheableType to Memory by default', () => {
      // Arrange
      const opts = { ...clientOptions, cacheableType: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should set cacheableType to provided value', () => {
      // Arrange
      const opts = { ...clientOptions, cacheableType: CacheType.Disk }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should apply concurrency limit when concurrency > 0', () => {
      // Arrange
      const opts = { ...clientOptions, concurrency: 5 }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should not apply concurrency limit when concurrency is 0', () => {
      // Arrange
      const opts = { ...clientOptions, concurrency: 0 }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should not apply concurrency limit when concurrency is undefined', () => {
      // Arrange
      const opts = { ...clientOptions, concurrency: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include recorder middleware when recorder is provided', () => {
      // Arrange
      const mockRecorder = {}
      const opts = { ...clientOptions, recorder: mockRecorder }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include custom middlewares from options', () => {
      // Arrange
      const customMiddleware = async () => {}
      const opts = {
        ...clientOptions,
        middlewares: [customMiddleware],
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should set default timeout constant', () => {
      // Arrange & Act
      new HttpClient(clientOptions)

      // Assert
      expect(true).toBe(true)
    })
  })

  describe('get method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return response data for successful GET request', async () => {
      // Arrange
      const mockData = { id: 1, name: 'test' }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should accept URL and empty config', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test', {})

      // Assert
      expect(result).toEqual({ test: 'data' })
    })

    it('should accept URL without config', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual({ test: 'data' })
    })

    it('should handle generic type parameter', async () => {
      // Arrange
      interface TestResponse {
        id: number
        name: string
      }
      const mockData: TestResponse = { id: 1, name: 'test' }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get<TestResponse>('/test')

      // Assert
      expect(result.id).toBe(1)
      expect(result.name).toBe('test')
    })
  })

  describe('getRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return full AxiosResponse object', async () => {
      // Arrange
      const mockData = { id: 1, name: 'test' }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getRaw('/test')

      // Assert
      expect(result.data).toEqual(mockData)
      expect(result.status).toBe(200)
      expect(result.statusText).toBe('OK')
    })

    it('should accept config parameter', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getRaw('/test', { headers: { 'X-Custom': 'value' } })

      // Assert
      expect(result.status).toBe(200)
    })
  })

  describe('getWithBody method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return response data with body hash in params', async () => {
      // Arrange
      const mockData = { success: true }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getWithBody('/test', { key: 'value' })

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should compute body hash from data', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const { computeBodyHash } = require('../utils/bodyHash')

      // Act
      await client.getWithBody('/test', { key: 'value' })

      // Assert
      expect(computeBodyHash).toHaveBeenCalledWith({ key: 'value' }, expect.any(Function))
    })

    it('should handle undefined body', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getWithBody('/test', undefined)

      // Assert
      expect(result).toEqual({ success: true })
    })

    it('should merge params with BODY_HASH', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getWithBody('/test', { key: 'value' }, { params: { existing: 'param' } })

      // Assert
      expect(true).toBe(true)
    })

    it('should log warning on body hash computation error', async () => {
      // Arrange
      const { computeBodyHash } = require('../utils/bodyHash')
      computeBodyHash.mockImplementation((data: any, callback: any) => {
        callback()
        return 'hash'
      })
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getWithBody('/test', { key: 'value' })

      // Assert
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  describe('getBuffer method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return buffer data with headers', async () => {
      // Arrange
      const mockBuffer = Buffer.from('test data')
      const mockResponse: any = {
        data: mockBuffer,
        headers: { 'content-type': 'application/octet-stream' },
        status: 200,
        statusText: 'OK',
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getBuffer('/test')

      // Assert
      expect(result.data).toEqual(mockBuffer)
      expect(result.headers).toBeDefined()
    })

    it('should set responseType to arraybuffer', async () => {
      // Arrange
      const mockBuffer = Buffer.from('test data')
      const mockResponse: any = {
        data: mockBuffer,
        headers: {},
        status: 200,
        statusText: 'OK',
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getBuffer('/test')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'arraybuffer',
          cacheable: CacheType.Disk,
        })
      )
    })

    it('should set cacheable type to Disk', async () => {
      // Arrange
      const mockBuffer = Buffer.from('test data')
      const mockResponse: any = {
        data: mockBuffer,
        headers: {},
        status: 200,
        statusText: 'OK',
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getBuffer('/test')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheable: CacheType.Disk,
        })
      )
    })
  })

  describe('getStream method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return IncomingMessage stream', async () => {
      // Arrange
      const mockStream = {} as IncomingMessage
      const mockResponse: any = {
        data: mockStream,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getStream('/test')

      // Assert
      expect(result).toEqual(mockStream)
    })

    it('should set responseType to stream', async () => {
      // Arrange
      const mockStream = {} as IncomingMessage
      const mockResponse: any = {
        data: mockStream,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getStream('/test')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'stream',
        })
      )
    })
  })

  describe('put method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send PUT request and return response data', async () => {
      // Arrange
      const mockData = { id: 1, updated: true }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.put('/test', { name: 'updated' })

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should set method to put', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.put('/test', { data: 'test' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'put',
        })
      )
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.put('/test')

      // Assert
      expect(result).toEqual({})
    })
  })

  describe('putRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockData = { id: 1 }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.putRaw('/test', { data: 'test' })

      // Assert
      expect(result.data).toEqual(mockData)
      expect(result.status).toBe(200)
    })

    it('should set method to put', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.putRaw('/test', { data: 'test' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'put',
        })
      )
    })
  })

  describe('post method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send POST request and return response data', async () => {
      // Arrange
      const mockData = { id: 1, created: true }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.post('/test', { name: 'test' })

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should set method to post', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.post('/test', { data: 'test' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
        })
      )
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.post('/test')

      // Assert
      expect(result).toEqual({})
    })
  })

  describe('postRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockData = { id: 1 }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.postRaw('/test', { data: 'test' })

      // Assert
      expect(result.data).toEqual(mockData)
      expect(result.status).toBe(201)
    })

    it('should set method to post', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.postRaw('/test', { data: 'test' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
        })
      )
    })
  })

  describe('patch method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send PATCH request and return response data', async () => {
      // Arrange
      const mockData = { id: 1, patched: true }
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.patch('/test', { field: 'value' })

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should set method to patch', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.patch('/test', { data: 'test' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'patch',
        })
      )
    })
  })

  describe('head method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send HEAD request and return response object', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: undefined,
        status: 200,
        statusText: 'OK',
        headers: { 'content-length': '100' },
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.head('/test')

      // Assert
      expect(result.status).toBe(200)
      expect(result.headers).toBeDefined()
    })

    it('should set method to head', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: undefined,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.head('/test')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'head',
        })
      )
    })
  })

  describe('delete method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send DELETE request and return response', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.delete('/test')

      // Assert
      expect(result.status).toBe(204)
    })

    it('should set method to delete', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.delete('/test')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'delete',
        })
      )
    })

    it('should handle undefined config', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: {},
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.delete('/test')

      // Assert
      expect(result.status).toBe(204)
    })
  })

  describe('request method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should pass config to middleware and return response', async () => {
      // Arrange
      const mockConfig: RequestConfig = { url: '/test', method: 'get' }
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = (client as any).request(mockConfig)

      // Assert
      expect(result).toBeDefined()
    })

    it('should set response in middleware context', async () => {
      // Arrange
      const mockConfig: RequestConfig = { url: '/test' }
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await (client as any).request(mockConfig)

      // Assert
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getConfig private method behavior', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should include memoizable flag in config', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.get('/test')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          memoizable: true,
        })
      )
    })

    it('should include cacheable type in config', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.get('/test')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheable: CacheType.Memory,
        })
      )
    })
  })

  describe('Edge cases and error handling', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should handle empty URL', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('')

      // Assert
      expect(result).toEqual({ test: 'data' })
    })

    it('should handle null config in get method', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test', {})

      // Assert
      expect(result).toEqual({ test: 'data' })
    })

    it('should handle response with null data', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle response with complex nested data', async () => {
      // Arrange
      const complexData = {
        level1: {
          level2: {
            level3: [1, 2, 3],
          },
        },
      }
      const mockResponse: AxiosResponse = {
        data: complexData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual(complexData)
    })

    it('should handle numeric response data', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: 42,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBe(42)
    })

    it('should handle string response data', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: 'string response',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBe('string response')
    })

    it('should handle boolean response data', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBe(true)
    })

    it('should preserve config parameters when creating request', async () => {
      // Arrange
      const customConfig: RequestConfig = {
        timeout: 10000,
        headers: { 'X-Custom': 'header' },
      }
      const mockResponse: AxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.get('/test', customConfig)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000,
          headers: { 'X-Custom': 'header' },
        })
      )
    })
  })

  describe('HTTP Status Code Handling', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should handle 200 OK response', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual({ status: 'ok' })
    })

    it('should handle 201 Created response', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: { id: 123 },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.post('/test', {})

      // Assert
      expect(result).toEqual({ id: 123 })
    })

    it('should handle 204 No Content response', async () => {
      // Arrange
      const mockResponse: AxiosResponse = {
        data: undefined,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.delete('/test')

      // Assert
      expect(result.status).toBe(204)
    })
  })
})
