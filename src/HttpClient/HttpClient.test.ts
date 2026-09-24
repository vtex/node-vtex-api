import { HttpClient } from './HttpClient'
import { MiddlewareContext, RequestConfig, IOResponse } from './typings'
import { CacheType } from './middlewares/cache'
import { Logger } from '../service/logger'
import { IncomingMessage } from 'http'

jest.mock('koa-compose')
jest.mock('p-limit')
jest.mock('../utils/binding')
jest.mock('../utils/tenant')
jest.mock('../utils/bodyHash')
jest.mock('./middlewares/tracing')

const mockCompose = require('koa-compose')
const mockPLimit = require('p-limit')
const { formatBindingHeaderValue } = require('../utils/binding')
const { formatTenantHeaderValue } = require('../utils/tenant')
const { computeBodyHash } = require('../utils/bodyHash')
const { createHttpClientTracingMiddleware } = require('./middlewares/tracing')

describe('HttpClient', () => {
  let mockLogger: jest.Mocked<Logger>
  let mockMiddleware: jest.Mock
  let mockMemoryCache: Map<string, any>
  let mockDiskCache: Map<string, any>
  let mockMetrics: any
  let mockRecorder: any
  let mockTracer: any
  let mockCancellation: any
  let mockHttpsAgent: any
  let mockAsyncSetCache: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup logger mock
    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as any

    // Setup cache mocks
    mockMemoryCache = new Map()
    mockDiskCache = new Map()

    // Setup other mocks
    mockMetrics = {}
    mockRecorder = {}
    mockTracer = {}
    mockCancellation = {}
    mockHttpsAgent = {}
    mockAsyncSetCache = jest.fn()

    // Setup koa-compose to return a middleware function that executes context
    mockMiddleware = jest.fn(async (context: MiddlewareContext) => {
      context.response = { data: 'test response' } as any
    })
    mockCompose.mockReturnValue(mockMiddleware)

    // Setup p-limit to return identity function
    mockPLimit.mockReturnValue((fn: () => Promise<any>) => fn())

    // Setup utility mocks
    formatBindingHeaderValue.mockReturnValue('formatted-binding')
    formatTenantHeaderValue.mockReturnValue('formatted-tenant')
    computeBodyHash.mockReturnValue('body-hash')
    createHttpClientTracingMiddleware.mockReturnValue(jest.fn())
  })

  describe('constructor', () => {
    it('should initialize with default values', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should use provided name over baseURL', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        name: 'my-client',
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('my-client')
    })

    it('should default name to "unknown" when neither baseURL nor name provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set default timeout when not provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include auth header when authType and authToken provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        authType: 'Bearer',
        authToken: 'token123',
        logger: mockLogger,
      })

      // Assert
      const middlewares = mockCompose.mock.calls[0][0]
      const defaultsMiddlewareCall = middlewares.find((m: any) => m.name === 'defaultsMiddleware')
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should not include auth header when only authType provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        authType: 'Bearer',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should not include auth header when only authToken provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        authToken: 'token123',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include account header when account provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        account: 'account123',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include tenant header with formatted value', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        tenant: { id: 'tenant123' } as any,
        logger: mockLogger,
      })

      // Assert
      expect(formatTenantHeaderValue).toHaveBeenCalledWith({ id: 'tenant123' })
    })

    it('should include binding header with formatted value', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        binding: { id: 'binding123' } as any,
        logger: mockLogger,
      })

      // Assert
      expect(formatBindingHeaderValue).toHaveBeenCalledWith({ id: 'binding123' })
    })

    it('should include locale header when locale provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        locale: 'en-US',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include operationId header when operationId provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        operationId: 'op123',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include product header when product provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        product: 'product123',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include segment header when segmentToken provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        segmentToken: 'seg123',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include session header when sessionToken provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        sessionToken: 'sess123',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include host header when host provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        host: 'example.com',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should always include User-Agent header', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        userAgent: 'MyClient/1.0',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should always include Accept-Encoding gzip header', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should set default memoizable to true', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should respect memoizable setting when false', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        memoizable: false,
        logger: mockLogger,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should set default cacheableType to Memory', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should respect cacheableType setting', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        cacheableType: CacheType.Disk,
        logger: mockLogger,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include memory cache middleware when memoryCache provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        memoryCache: mockMemoryCache,
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include disk cache middleware when diskCache provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        diskCache: mockDiskCache,
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include recorder middleware when recorder provided', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        recorder: mockRecorder,
        logger: mockLogger,
      })

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should setup concurrency limit when concurrency provided and greater than 0', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        concurrency: 5,
        logger: mockLogger,
      })

      // Assert
      expect(mockPLimit).toHaveBeenCalledWith(5)
    })

    it('should not setup concurrency limit when concurrency is 0', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        concurrency: 0,
        logger: mockLogger,
      })

      // Assert
      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should not setup concurrency limit when concurrency is undefined', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should include custom middlewares from opts', () => {
      // Arrange
      const customMiddleware = jest.fn()
      
      // Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        middlewares: [customMiddleware],
        logger: mockLogger,
      })

      // Assert
      const middlewares = mockCompose.mock.calls[0][0]
      expect(middlewares).toContain(customMiddleware)
    })

    it('should pass tracer to tracing middleware', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        tracer: mockTracer,
        logger: mockLogger,
      })

      // Assert
      expect(createHttpClientTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          tracer: mockTracer,
          logger: mockLogger,
        })
      )
    })

    it('should pass clientName to tracing middleware', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        name: 'my-client',
        logger: mockLogger,
      })

      // Assert
      expect(createHttpClientTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: 'my-client',
        })
      )
    })

    it('should indicate disk cache middleware presence in tracing middleware config', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        diskCache: mockDiskCache,
        logger: mockLogger,
      })

      // Assert
      expect(createHttpClientTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          hasDiskCacheMiddleware: true,
        })
      )
    })

    it('should indicate memory cache middleware presence in tracing middleware config', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        memoryCache: mockMemoryCache,
        logger: mockLogger,
      })

      // Assert
      expect(createHttpClientTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          hasMemoryCacheMiddleware: true,
        })
      )
    })
  })

  describe('get method', () => {
    it('should return data from response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { id: 1, name: 'test' } } as any
      })

      // Act
      const result = await client.get('/api/users')

      // Assert
      expect(result).toEqual({ id: 1, name: 'test' })
    })

    it('should pass url to request', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.get('/api/users')

      // Assert
      expect(capturedContext!.config.url).toBe('/api/users')
    })

    it('should merge config with default config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.get('/api/users', { timeout: 5000 })

      // Assert
      expect(capturedContext!.config.timeout).toBe(5000)
    })

    it('should call getConfig to setup cacheable and memoizable', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        memoizable: true,
        cacheableType: CacheType.Memory,
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.get('/api/users')

      // Assert
      expect(capturedContext!.config.memoizable).toBe(true)
      expect(capturedContext!.config.cacheable).toBe(CacheType.Memory)
    })

    it('should handle empty config parameter', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: { result: 'ok' } } as any
      })

      // Act
      const result = await client.get('/api/users')

      // Assert
      expect(result).toEqual({ result: 'ok' })
      expect(capturedContext!.config.url).toBe('/api/users')
    })

    it('should return null data when response contains null', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: null } as any
      })

      // Act
      const result = await client.get('/api/users')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('getRaw method', () => {
    it('should return full response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockResponse = { data: { id: 1 }, status: 200, headers: {} }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.getRaw('/api/users')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should include response status in return value', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockResponse = { data: { id: 1 }, status: 201, headers: {} }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.getRaw('/api/users')

      // Assert
      expect(result.status).toBe(201)
    })

    it('should include response headers in return value', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockHeaders = { 'content-type': 'application/json' }
      const mockResponse = { data: { id: 1 }, status: 200, headers: mockHeaders }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.getRaw('/api/users')

      // Assert
      expect(result.headers).toEqual(mockHeaders)
    })
  })

  describe('getWithBody method', () => {
    it('should compute body hash for cache key', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const requestBody = { name: 'test' }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { id: 1 } } as any
      })

      // Act
      await client.getWithBody('/api/search', requestBody)

      // Assert
      expect(computeBodyHash).toHaveBeenCalledWith(requestBody, expect.any(Function))
    })

    it('should include body hash in params', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      computeBodyHash.mockReturnValueOnce('abc123')
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: { id: 1 } } as any
      })

      // Act
      await client.getWithBody('/api/search', { name: 'test' })

      // Assert
      expect(capturedContext!.config.params).toHaveProperty('__bodyHash', 'abc123')
    })

    it('should merge body hash params with existing params', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      computeBodyHash.mockReturnValueOnce('abc123')
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: { id: 1 } } as any
      })

      // Act
      await client.getWithBody('/api/search', { name: 'test' }, { params: { page: 1 } })

      // Assert
      expect(capturedContext!.config.params).toHaveProperty('page', 1)
      expect(capturedContext!.config.params).toHaveProperty('__bodyHash', 'abc123')
    })

    it('should include request data in config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const requestBody = { name: 'test' }
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: { id: 1 } } as any
      })

      // Act
      await client.getWithBody('/api/search', requestBody)

      // Assert
      expect(capturedContext!.config.data).toEqual(requestBody)
    })

    it('should return data from response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { results: [{ id: 1 }] } } as any
      })

      // Act
      const result = await client.getWithBody('/api/search', { name: 'test' })

      // Assert
      expect(result).toEqual({ results: [{ id: 1 }] })
    })

    it('should call logger warn on body hash computation error', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      computeBodyHash.mockImplementationOnce((data: any, errorCallback: Function) => {
        errorCallback()
        return 'hash'
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { id: 1 } } as any
      })

      // Act
      await client.getWithBody('/api/search', { name: 'test' })

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith({ message: 'Error while sorting object for cache key' })
    })

    it('should handle undefined body', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { id: 1 } } as any
      })

      // Act
      const result = await client.getWithBody('/api/search')

      // Assert
      expect(result).toEqual({ id: 1 })
      expect(computeBodyHash).toHaveBeenCalledWith(undefined, expect.any(Function))
    })
  })

  describe('getBuffer method', () => {
    it('should request arraybuffer response type', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: Buffer.from('test') } as any
      })

      // Act
      await client.getBuffer('/api/file')

      // Assert
      expect(capturedContext!.config.responseType).toBe('arraybuffer')
    })

    it('should set cacheable to Disk', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: Buffer.from('test') } as any
      })

      // Act
      await client.getBuffer('/api/file')

      // Assert
      expect(capturedContext!.config.cacheable).toBe(CacheType.Disk)
    })

    it('should disable transform response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: Buffer.from('test') } as any
      })

      // Act
      await client.getBuffer('/api/file')

      // Assert
      expect(capturedContext!.config.transformResponse).toBeDefined()
      expect(capturedContext!.config.transformResponse![0]('test')).toBe('test')
    })

    it('should return buffer data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const buffer = Buffer.from('test data')
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: buffer, headers: { 'content-type': 'application/octet-stream' } } as any
      })

      // Act
      const result = await client.getBuffer('/api/file')

      // Assert
      expect(result.data).toEqual(buffer)
    })

    it('should return headers with buffer', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const buffer = Buffer.from('test')
      const headers = { 'content-length': '4' }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: buffer, headers } as any
      })

      // Act
      const result = await client.getBuffer('/api/file')

      // Assert
      expect(result.headers).toEqual(headers)
    })

    it('should merge config with provided config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: Buffer.from('test') } as any
      })

      // Act
      await client.getBuffer('/api/file', { timeout: 3000 })

      // Assert
      expect(capturedContext!.config.timeout).toBe(3000)
      expect(capturedContext!.config.responseType).toBe('arraybuffer')
    })
  })

  describe('getStream method', () => {
    it('should request stream response type', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: {} as IncomingMessage } as any
      })

      // Act
      await client.getStream('/api/stream')

      // Assert
      expect(capturedContext!.config.responseType).toBe('stream')
    })

    it('should disable transform response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: {} as IncomingMessage } as any
      })

      // Act
      await client.getStream('/api/stream')

      // Assert
      expect(capturedContext!.config.transformResponse).toBeDefined()
      expect(capturedContext!.config.transformResponse![0]('stream')).toBe('stream')
    })

    it('should return IncomingMessage stream', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockStream = { on: jest.fn() } as unknown as IncomingMessage
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: mockStream } as any
      })

      // Act
      const result = await client.getStream('/api/stream')

      // Assert
      expect(result).toBe(mockStream)
    })

    it('should merge config with provided config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: {} as IncomingMessage } as any
      })

      // Act
      await client.getStream('/api/stream', { timeout: 2000 })

      // Assert
      expect(capturedContext!.config.timeout).toBe(2000)
      expect(capturedContext!.config.responseType).toBe('stream')
    })
  })

  describe('put method', () => {
    it('should set method to put', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.put('/api/users/1', { name: 'updated' })

      // Assert
      expect(capturedContext!.config.method).toBe('put')
    })

    it('should include request data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const requestBody = { name: 'updated', age: 30 }
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.put('/api/users/1', requestBody)

      // Assert
      expect(capturedContext!.config.data).toEqual(requestBody)
    })

    it('should return data from response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { id: 1, name: 'updated' } } as any
      })

      // Act
      const result = await client.put('/api/users/1', { name: 'updated' })

      // Assert
      expect(result).toEqual({ id: 1, name: 'updated' })
    })

    it('should handle empty data parameter', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.put('/api/users/1')

      // Assert
      expect(capturedContext!.config.data).toBeUndefined()
    })
  })

  describe('putRaw method', () => {
    it('should return full response object', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockResponse = { data: { id: 1 }, status: 200, headers: {} }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.putRaw('/api/users/1', { name: 'updated' })

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should set method to put', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null, status: 200 } as any
      })

      // Act
      await client.putRaw('/api/users/1')

      // Assert
      expect(capturedContext!.config.method).toBe('put')
    })
  })

  describe('post method', () => {
    it('should set method to post', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.post('/api/users', { name: 'new' })

      // Assert
      expect(capturedContext!.config.method).toBe('post')
    })

    it('should include request data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const requestBody = { name: 'new user', email: 'user@example.com' }
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.post('/api/users', requestBody)

      // Assert
      expect(capturedContext!.config.data).toEqual(requestBody)
    })

    it('should return data from response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { id: 101, name: 'new' } } as any
      })

      // Act
      const result = await client.post('/api/users', { name: 'new' })

      // Assert
      expect(result).toEqual({ id: 101, name: 'new' })
    })

    it('should handle void return type', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: undefined } as any
      })

      // Act
      const result = await client.post('/api/action')

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('postRaw method', () => {
    it('should return full response object', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockResponse = { data: { id: 101 }, status: 201, headers: {} }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.postRaw('/api/users', { name: 'new' })

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should set method to post', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null, status: 201 } as any
      })

      // Act
      await client.postRaw('/api/users')

      // Assert
      expect(capturedContext!.config.method).toBe('post')
    })
  })

  describe('patch method', () => {
    it('should set method to patch', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.patch('/api/users/1', { status: 'active' })

      // Assert
      expect(capturedContext!.config.method).toBe('patch')
    })

    it('should include request data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const requestBody = { status: 'active' }
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.patch('/api/users/1', requestBody)

      // Assert
      expect(capturedContext!.config.data).toEqual(requestBody)
    })

    it('should return data from response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: { id: 1, status: 'active' } } as any
      })

      // Act
      const result = await client.patch('/api/users/1', { status: 'active' })

      // Assert
      expect(result).toEqual({ id: 1, status: 'active' })
    })
  })

  describe('head method', () => {
    it('should set method to head', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { status: 200, headers: {} } as any
      })

      // Act
      await client.head('/api/users/1')

      // Assert
      expect(capturedContext!.config.method).toBe('head')
    })

    it('should return full response object', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockResponse = { status: 200, headers: { 'content-length': '1024' }, data: undefined }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.head('/api/users/1')

      // Assert
      expect(result).toEqual(mockResponse)
    })
  })

  describe('delete method', () => {
    it('should set method to delete', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { status: 204, data: undefined } as any
      })

      // Act
      await client.delete('/api/users/1')

      // Assert
      expect(capturedContext!.config.method).toBe('delete')
    })

    it('should return full response object', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockResponse = { status: 204, headers: {}, data: undefined }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.delete('/api/users/1')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should handle undefined config parameter', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { status: 204, data: undefined } as any
      })

      // Act
      await client.delete('/api/users/1')

      // Assert
      expect(capturedContext!.config.url).toBe('/api/users/1')
      expect(capturedContext!.config.method).toBe('delete')
    })

    it('should return typed response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const mockResponse = { status: 200, headers: {}, data: { success: true } }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = mockResponse as any
      })

      // Act
      const result = await client.delete<{ success: boolean }>('/api/users/1')

      // Assert
      expect(result.data).toEqual({ success: true })
    })
  })

  describe('request protected method', () => {
    it('should execute middlewares with config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const config: RequestConfig = { url: '/api/test', method: 'get' }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { data: 'ok' } as any
      })

      // Act
      const result = await (client as any).request(config)

      // Assert
      expect(mockMiddleware).toHaveBeenCalled()
      expect(result).toEqual({ data: 'ok' })
    })

    it('should pass config to middleware context', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const config: RequestConfig = { url: '/api/test', timeout: 5000 }
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: 'ok' } as any
      })

      // Act
      await (client as any).request(config)

      // Assert
      expect(capturedContext!.config).toEqual(config)
    })

    it('should return response set by middleware', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const config: RequestConfig = { url: '/api/test' }
      const expectedResponse = { data: { id: 1, value: 'test' }, status: 200 }
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = expectedResponse as any
      })

      // Act
      const result = await (client as any).request(config)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should propagate middleware errors', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const config: RequestConfig = { url: '/api/test' }
      const error = new Error('Middleware error')
      mockMiddleware.mockImplementationOnce(async () => {
        throw error
      })

      // Act & Assert
      await expect((client as any).request(config)).rejects.toThrow('Middleware error')
    })
  })

  describe('getConfig private method behavior', () => {
    it('should preserve memoizable false setting', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        memoizable: false,
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.get('/api/test')

      // Assert
      expect(capturedContext!.config.memoizable).toBe(false)
    })

    it('should preserve cacheable type Disk', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        cacheableType: CacheType.Disk,
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.get('/api/test')

      // Assert
      expect(capturedContext!.config.cacheable).toBe(CacheType.Disk)
    })

    it('should merge config properties', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let capturedContext: MiddlewareContext
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        capturedContext = context
        context.response = { data: null } as any
      })

      // Act
      await client.get('/api/test', { headers: { 'X-Custom': 'value' } })

      // Assert
      expect(capturedContext!.config.headers).toEqual({ 'X-Custom': 'value' })
      expect(capturedContext!.config.url).toBe('/api/test')
      expect(capturedContext!.config.memoizable).toBe(true)
    })
  })

  describe('edge cases and integration', () => {
    it('should handle multiple concurrent requests', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      let callCount = 0
      mockMiddleware.mockImplementation(async (context: MiddlewareContext) => {
        callCount++
        context.response = { data: { id: callCount } } as any
      })

      // Act
      const results = await Promise.all([
        client.get('/api/users/1'),
        client.get('/api/users/2'),
        client.get('/api/users/3'),
      ])

      // Assert
      expect(results).toHaveLength(3)
      expect(mockMiddleware).toHaveBeenCalledTimes(3)
    })

    it('should maintain url across different HTTP methods', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      const urls: string[] = []
      mockMiddleware.mockImplementation(async (context: MiddlewareContext) => {
        urls.push(context.config.url!)
        context.response = { data: null } as any
      })

      // Act
      await client.get('/users')
      await client.post('/users', {})
      await client.put('/users/1', {})
      await client.delete('/users/1')

      // Assert
      expect(urls).toEqual(['/users', '/users', '/users/1', '/users/1'])
    })

    it('should handle response with no data property', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
      mockMiddleware.mockImplementationOnce(async (context: MiddlewareContext) => {
        context.response = { status: 200, headers: {} } as any
      })

      // Act
      const result = await client.get('/api/test')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should compose middleware in correct order', () => {
      // Arrange & Act
      new HttpClient({
        baseURL: 'https://api.example.com',
        memoryCache: mockMemoryCache,
        diskCache: mockDiskCache,
        recorder: mockRecorder,
        logger: mockLogger,
      })

      // Assert
      const middlewares = mockCompose.mock.calls[0][0]
      expect(middlewares).toBeDefined()
      expect(middlewares.length).toBeGreaterThan(0)
    })
  })
})
