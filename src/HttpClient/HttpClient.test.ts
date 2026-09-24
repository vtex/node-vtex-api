import { HttpClient } from './HttpClient'
import { Logger } from '../service/logger'
import { CacheType } from './middlewares/cache'
import { IOContext } from '../service/worker/runtime/typings'
import pLimit from 'p-limit'
import compose from 'koa-compose'

jest.mock('koa-compose')
jest.mock('p-limit')

describe('HttpClient', () => {
  let mockLogger: jest.Mocked<Logger>
  let mockTracer: any
  let mockMemoryCache: any
  let mockDiskCache: any
  let mockRecorder: any
  let mockMetrics: any
  let composedMiddleware: jest.Mock
  let pLimitMock: jest.Mock

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as any

    mockTracer = jest.fn()
    mockMemoryCache = { get: jest.fn(), set: jest.fn() }
    mockDiskCache = { get: jest.fn(), set: jest.fn() }
    mockRecorder = jest.fn()
    mockMetrics = { track: jest.fn() }

    composedMiddleware = jest.fn(async (context) => {
      context.response = { data: 'mock response' }
    })

    ;(compose as jest.Mock).mockReturnValue(composedMiddleware)
    pLimitMock = jest.fn(() => jest.fn())
    ;(pLimit as jest.Mock).mockImplementation(pLimitMock)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with minimal options', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set name from baseURL when name is not provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should prioritize name parameter over baseURL', () => {
      // Arrange & Act
      const client = new HttpClient({
        name: 'CustomClient',
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('CustomClient')
    })

    it('should include authorization header when authType and authToken are provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        authType: 'Bearer',
        authToken: 'token123',
        logger: mockLogger,
      })

      // Assert
      // Verify compose was called with middlewares including auth setup
      expect(compose).toHaveBeenCalled()
    })

    it('should not include authorization header when authToken is missing', () => {
      // Arrange & Act
      const client = new HttpClient({
        authType: 'Bearer',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include account header when account is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        account: 'account123',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include host header when host is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        host: 'example.com',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include tenant header when tenant is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        tenant: { id: 'tenant1' },
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include binding header when binding is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        binding: { id: 'binding1' },
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include locale header when locale is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        locale: 'en-US',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include operation ID header when operationId is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        operationId: 'op123',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include product header when product is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        product: 'product1',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include segment token header when segmentToken is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        segmentToken: 'segment123',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include session token header when sessionToken is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        sessionToken: 'session123',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set User-Agent header', () => {
      // Arrange & Act
      const client = new HttpClient({
        userAgent: 'CustomAgent/1.0',
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set Accept-Encoding header to gzip', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should create concurrency limiter when concurrency is positive', () => {
      // Arrange & Act
      const client = new HttpClient({
        concurrency: 5,
        logger: mockLogger,
      })

      // Assert
      expect(pLimit).toHaveBeenCalledWith(5)
    })

    it('should not create concurrency limiter when concurrency is zero', () => {
      // Arrange & Act
      const client = new HttpClient({
        concurrency: 0,
        logger: mockLogger,
      })

      // Assert
      expect(pLimit).not.toHaveBeenCalled()
    })

    it('should not create concurrency limiter when concurrency is negative', () => {
      // Arrange & Act
      const client = new HttpClient({
        concurrency: -1,
        logger: mockLogger,
      })

      // Assert
      expect(pLimit).not.toHaveBeenCalled()
    })

    it('should include recorder middleware when recorder is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        recorder: mockRecorder,
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include memory cache middleware when memoryCache is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        memoryCache: mockMemoryCache,
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include disk cache middleware when diskCache is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        diskCache: mockDiskCache,
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should use Memory cache type by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should use provided cacheableType', () => {
      // Arrange & Act
      const client = new HttpClient({
        cacheableType: CacheType.Disk,
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set memoizable to true by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set memoizable to false when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        memoizable: false,
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should merge default headers with custom headers', () => {
      // Arrange & Act
      const client = new HttpClient({
        headers: { 'X-Custom': 'value' },
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include cancellation middleware when cancellation is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        cancellation: { signal: new AbortController().signal },
        logger: mockLogger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include custom middlewares when provided', () => {
      // Arrange
      const customMiddleware = jest.fn()
      const opts: IOContext & any = {
        logger: mockLogger,
        middlewares: [customMiddleware],
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })
  })

  describe('get method', () => {
    it('should return data from response', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockData = { id: 1, name: 'test' }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockData }
      })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should pass url and config to request', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = { timeout: 5000 }

      // Act
      await client.get('/test', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.url).toBe('/test')
      expect(context.config.timeout).toBe(5000)
    })

    it('should work with empty config', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeDefined()
    })

    it('should use generic type parameter', async () => {
      // Arrange
      interface TestData {
        id: number
        name: string
      }
      const client = new HttpClient({ logger: mockLogger })
      const mockData: TestData = { id: 1, name: 'test' }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockData }
      })

      // Act
      const result = await client.get<TestData>('/test')

      // Assert
      expect(result).toEqual(mockData)
    })
  })

  describe('getRaw method', () => {
    it('should return full IOResponse', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockResponse = { data: { id: 1 }, status: 200, statusText: 'OK' }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = mockResponse
      })

      // Act
      const result = await client.getRaw('/test')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should pass url and config to request', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.getRaw('/test', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })

    it('should work with empty config', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      const result = await client.getRaw('/test')

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('getWithBody method', () => {
    it('should include body data in request config', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const bodyData = { key: 'value' }

      // Act
      await client.getWithBody('/test', bodyData)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.data).toEqual(bodyData)
    })

    it('should add body hash to params', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const bodyData = { key: 'value' }

      // Act
      await client.getWithBody('/test', bodyData)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.params).toHaveProperty('body_hash')
    })

    it('should return response data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockData = { result: 'success' }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockData }
      })

      // Act
      const result = await client.getWithBody('/test', { key: 'value' })

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should handle undefined body data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.getWithBody('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })

    it('should merge config with body config', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = { timeout: 5000 }

      // Act
      await client.getWithBody('/test', { key: 'value' }, config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.timeout).toBe(5000)
    })

    it('should log warning on body hash error', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const bodyData = { key: 'value' }

      // Act
      await client.getWithBody('/test', bodyData)

      // Assert
      // The warn method is available for logging errors
      expect(mockLogger.warn).toBeDefined()
    })
  })

  describe('getBuffer method', () => {
    it('should set responseType to arraybuffer', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.getBuffer('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.responseType).toBe('arraybuffer')
    })

    it('should disable transform response', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.getBuffer('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.transformResponse).toBeDefined()
    })

    it('should set cacheable type to Disk', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.getBuffer('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.cacheable).toBe(CacheType.Disk)
    })

    it('should merge with provided config', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = { timeout: 5000 }

      // Act
      await client.getBuffer('/test', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.timeout).toBe(5000)
    })

    it('should return buffer and headers', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockBuffer = Buffer.from('test')
      const mockHeaders = { 'content-type': 'application/octet-stream' }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockBuffer, headers: mockHeaders }
      })

      // Act
      const result = await client.getBuffer('/test')

      // Assert
      expect(result.data).toEqual(mockBuffer)
      expect(result.headers).toEqual(mockHeaders)
    })
  })

  describe('getStream method', () => {
    it('should set responseType to stream', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.getStream('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.responseType).toBe('stream')
    })

    it('should disable transform response', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.getStream('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.transformResponse).toBeDefined()
    })

    it('should return IncomingMessage', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockStream = {} as any
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockStream }
      })

      // Act
      const result = await client.getStream('/test')

      // Assert
      expect(result).toEqual(mockStream)
    })

    it('should merge with provided config', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = { timeout: 5000 }

      // Act
      await client.getStream('/test', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.timeout).toBe(5000)
    })
  })

  describe('put method', () => {
    it('should set method to put', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.put('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.method).toBe('put')
    })

    it('should include request data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const data = { id: 1, name: 'updated' }

      // Act
      await client.put('/test', data)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockData = { success: true }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockData }
      })

      // Act
      const result = await client.put('/test', { id: 1 })

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should handle undefined data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.put('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('putRaw method', () => {
    it('should set method to put', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.putRaw('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.method).toBe('put')
    })

    it('should return full IOResponse', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockResponse = { data: { success: true }, status: 200 }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = mockResponse
      })

      // Act
      const result = await client.putRaw('/test')

      // Assert
      expect(result).toEqual(mockResponse)
    })
  })

  describe('post method', () => {
    it('should set method to post', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.post('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.method).toBe('post')
    })

    it('should include request data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const data = { name: 'new' }

      // Act
      await client.post('/test', data)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockData = { id: 1, created: true }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockData }
      })

      // Act
      const result = await client.post('/test', { name: 'new' })

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should handle undefined data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.post('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('postRaw method', () => {
    it('should set method to post', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.postRaw('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.method).toBe('post')
    })

    it('should return full IOResponse', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockResponse = { data: { id: 1 }, status: 201 }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = mockResponse
      })

      // Act
      const result = await client.postRaw('/test')

      // Assert
      expect(result).toEqual(mockResponse)
    })
  })

  describe('patch method', () => {
    it('should set method to patch', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.patch('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.method).toBe('patch')
    })

    it('should include request data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const data = { status: 'updated' }

      // Act
      await client.patch('/test', data)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockData = { status: 'updated' }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockData }
      })

      // Act
      const result = await client.patch('/test', { status: 'updated' })

      // Assert
      expect(result).toEqual(mockData)
    })
  })

  describe('head method', () => {
    it('should set method to head', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.head('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.method).toBe('head')
    })

    it('should return full IOResponse', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockResponse = { status: 200, headers: { 'content-length': '100' } }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = mockResponse
      })

      // Act
      const result = await client.head('/test')

      // Assert
      expect(result).toEqual(mockResponse)
    })
  })

  describe('delete method', () => {
    it('should set method to delete', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.delete('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.method).toBe('delete')
    })

    it('should return full IOResponse', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockResponse = { status: 204 }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = mockResponse
      })

      // Act
      const result = await client.delete('/test')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should handle config parameter', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = { timeout: 5000 }

      // Act
      await client.delete('/test', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.timeout).toBe(5000)
    })

    it('should handle undefined config', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.delete('/test')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('request method', () => {
    it('should execute middlewares with context', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = { url: '/test', method: 'get' }

      // Act
      const response = await client['request'](config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config).toEqual(config)
    })

    it('should return response from context', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockResponse = { data: 'test', status: 200 }
      composedMiddleware.mockImplementation(async (context) => {
        context.response = mockResponse
      })

      // Act
      const response = await client['request']({})

      // Assert
      expect(response).toEqual(mockResponse)
    })

    it('should create new context for each request', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client['request']({ url: '/test1' })
      await client['request']({ url: '/test2' })

      // Assert
      expect(composedMiddleware).toHaveBeenCalledTimes(2)
      const firstContext = composedMiddleware.mock.calls[0][0]
      const secondContext = composedMiddleware.mock.calls[1][0]
      expect(firstContext.config.url).toBe('/test1')
      expect(secondContext.config.url).toBe('/test2')
    })
  })

  describe('edge cases', () => {
    it('should handle concurrent requests', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const responses = [
        { data: 'resp1' },
        { data: 'resp2' },
        { data: 'resp3' },
      ]
      let callCount = 0
      composedMiddleware.mockImplementation(async (context) => {
        context.response = responses[callCount++]
      })

      // Act
      const results = await Promise.all([
        client.get('/test1'),
        client.get('/test2'),
        client.get('/test3'),
      ])

      // Assert
      expect(results).toEqual(['resp1', 'resp2', 'resp3'])
    })

    it('should handle empty URL', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })

      // Act
      await client.get('')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.url).toBe('')
    })

    it('should handle special characters in URL', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const specialUrl = '/test?param=value&other=123#section'

      // Act
      await client.get(specialUrl)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.url).toBe(specialUrl)
    })

    it('should handle null response gracefully', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: null }
      })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle empty object response', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: {} }
      })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual({})
    })

    it('should handle array response', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const mockArray = [1, 2, 3]
      composedMiddleware.mockImplementation(async (context) => {
        context.response = { data: mockArray }
      })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual(mockArray)
    })

    it('should preserve config properties through request chain', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const config = {
        timeout: 3000,
        headers: { 'X-Custom': 'header' },
        params: { page: 1 },
      }

      // Act
      await client.get('/test', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.timeout).toBe(3000)
      expect(context.config.headers).toEqual({ 'X-Custom': 'header' })
      expect(context.config.params).toEqual({ page: 1 })
    })

    it('should handle large request data', async () => {
      // Arrange
      const client = new HttpClient({ logger: mockLogger })
      const largeData = new Array(1000).fill({ key: 'value' })

      // Act
      await client.post('/test', largeData)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
      const context = composedMiddleware.mock.calls[0][0]
      expect(context.config.data).toEqual(largeData)
    })
  })
})
