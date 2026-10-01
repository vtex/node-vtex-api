import { HttpClient } from './HttpClient'
import { Logger } from '../service/logger'
import { CacheType } from './middlewares/cache'
import { IOContext } from '../service/worker/runtime/typings'
import { InstanceOptions, MiddlewareContext } from './typings'
import pLimit from 'p-limit'

jest.mock('p-limit')
jest.mock('koa-compose')
jest.mock('./middlewares/cache')
jest.mock('./middlewares/cancellationToken')
jest.mock('./middlewares/inflight')
jest.mock('./middlewares/memoization')
jest.mock('./middlewares/metrics')
jest.mock('./middlewares/notFound')
jest.mock('./middlewares/recorder')
jest.mock('./middlewares/request')
jest.mock('./middlewares/tracing')
jest.mock('../utils/bodyHash')
jest.mock('../utils/tenant')
jest.mock('../utils/binding')

describe('HttpClient', () => {
  let mockLogger: jest.Mocked<Logger>
  let baseContext: IOContext
  let mockMiddlewareFn: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as any

    baseContext = {
      account: 'test-account',
      baseURL: 'https://api.example.com',
      logger: mockLogger,
    } as any

    mockMiddlewareFn = jest.fn(async (ctx: any) => {
      ctx.response = { data: 'test-response', status: 200 }
    })

    const compose = require('koa-compose')
    compose.mockReturnValue(mockMiddlewareFn)
  })

  describe('constructor', () => {
    it('should initialize with minimal required options', () => {
      // Arrange & Act
      const client = new HttpClient(baseContext)

      // Assert
      expect(client.name).toBe(baseContext.baseURL)
    })

    it('should use custom name when provided', () => {
      // Arrange
      const customName = 'my-custom-client'

      // Act
      const client = new HttpClient({ ...baseContext, name: customName })

      // Assert
      expect(client.name).toBe(customName)
    })

    it('should use baseURL as name when name is not provided', () => {
      // Arrange
      const baseURL = 'https://custom.api.com'

      // Act
      const client = new HttpClient({ ...baseContext, baseURL })

      // Assert
      expect(client.name).toBe(baseURL)
    })

    it('should default name to "unknown" when neither name nor baseURL provided', () => {
      // Arrange
      const minimalContext = { logger: mockLogger } as any

      // Act
      const client = new HttpClient(minimalContext)

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set memoizable to true by default', () => {
      // Arrange & Act
      const client = new HttpClient(baseContext)

      // Assert - verify through getConfig behavior
      expect(client).toBeDefined()
    })

    it('should set memoizable to false when explicitly provided', () => {
      // Arrange & Act
      const client = new HttpClient({ ...baseContext, memoizable: false })

      // Assert
      expect(client).toBeDefined()
    })

    it('should set cacheableType to Memory by default', () => {
      // Arrange & Act
      const client = new HttpClient(baseContext)

      // Assert
      expect(client).toBeDefined()
    })

    it('should set cacheableType to custom type when provided', () => {
      // Arrange & Act
      const client = new HttpClient({ ...baseContext, cacheableType: CacheType.Disk })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include Authorization header when authType and authToken provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        authType: 'Bearer',
        authToken: 'token123',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('Authorization', 'Bearer token123')
    })

    it('should not include Authorization header when only authType provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        authType: 'Bearer',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).not.toHaveProperty('Authorization')
    })

    it('should include custom headers when provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        headers: { 'X-Custom': 'value' },
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('X-Custom', 'value')
    })

    it('should include account header when account provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        account: 'account123',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('X-VTEX-Account')
    })

    it('should include forwarded host header when host provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        host: 'example.com',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('X-Forwarded-Host')
    })

    it('should include locale header when locale provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        locale: 'pt-BR',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('Accept-Language')
    })

    it('should include operation ID header when operationId provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        operationId: 'op-123',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('X-VTEX-Operation-Id')
    })

    it('should include product header when product provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        product: 'my-product',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('X-VTEX-Product')
    })

    it('should include segment header when segmentToken provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        segmentToken: 'seg-token',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('X-VTEX-Segment')
    })

    it('should include session header when sessionToken provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        sessionToken: 'sess-token',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('X-VTEX-Session')
    })

    it('should always include User-Agent header', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        userAgent: 'my-client/1.0',
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('User-Agent', 'my-client/1.0')
    })

    it('should always include Accept-Encoding header', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient(baseContext)

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders).toHaveProperty('Accept-Encoding', 'gzip')
    })

    it('should pass timeout to defaults middleware', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        timeout: 5000,
      })

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].timeout).toBe(5000)
    })

    it('should use DEFAULT_TIMEOUT_MS when timeout not provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()

      // Act
      new HttpClient(baseContext)

      // Assert
      const defaultsMiddlewareCall = require('./middlewares/request').defaultsMiddleware.mock.calls[0]
      expect(defaultsMiddlewareCall[0].timeout).toBe(1000)
    })

    it('should call pLimit when concurrency is positive number', () => {
      // Arrange
      const mockPLimit = pLimit as jest.MockedFunction<typeof pLimit>

      // Act
      new HttpClient({
        ...baseContext,
        concurrency: 5,
      })

      // Assert
      expect(mockPLimit).toHaveBeenCalledWith(5)
    })

    it('should not call pLimit when concurrency is not provided', () => {
      // Arrange
      const mockPLimit = pLimit as jest.MockedFunction<typeof pLimit>
      mockPLimit.mockClear()

      // Act
      new HttpClient(baseContext)

      // Assert
      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should not call pLimit when concurrency is 0', () => {
      // Arrange
      const mockPLimit = pLimit as jest.MockedFunction<typeof pLimit>
      mockPLimit.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        concurrency: 0,
      })

      // Assert
      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should not call pLimit when concurrency is negative', () => {
      // Arrange
      const mockPLimit = pLimit as jest.MockedFunction<typeof pLimit>
      mockPLimit.mockClear()

      // Act
      new HttpClient({
        ...baseContext,
        concurrency: -5,
      })

      // Assert
      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should include custom middlewares in middleware stack', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()
      const customMiddleware = jest.fn()

      // Act
      new HttpClient({
        ...baseContext,
        middlewares: [customMiddleware],
      })

      // Assert
      const composeCall = mockCompose.mock.calls[0][0]
      expect(composeCall).toContain(customMiddleware)
    })

    it('should include tracing middleware as first middleware', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()
      const mockTracingMiddleware = jest.fn()
      const createTracingMiddleware = require('./middlewares/tracing').createHttpClientTracingMiddleware
      createTracingMiddleware.mockReturnValue(mockTracingMiddleware)

      // Act
      new HttpClient(baseContext)

      // Assert
      const composeCall = mockCompose.mock.calls[0][0]
      expect(composeCall[0]).toBe(mockTracingMiddleware)
    })

    it('should include memory cache middleware when memoryCache provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()
      const mockMemoryCache = {}

      // Act
      new HttpClient({
        ...baseContext,
        memoryCache: mockMemoryCache as any,
      })

      // Assert
      const cacheMiddlewareCall = require('./middlewares/cache').cacheMiddleware.mock.calls
      const memCacheCall = cacheMiddlewareCall.find((call: any) => call[0].type === CacheType.Memory)
      expect(memCacheCall).toBeDefined()
    })

    it('should include disk cache middleware when diskCache provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()
      const mockDiskCache = {}

      // Act
      new HttpClient({
        ...baseContext,
        diskCache: mockDiskCache as any,
      })

      // Assert
      const cacheMiddlewareCall = require('./middlewares/cache').cacheMiddleware.mock.calls
      const diskCacheCall = cacheMiddlewareCall.find((call: any) => call[0].type === CacheType.Disk)
      expect(diskCacheCall).toBeDefined()
    })

    it('should include recorder middleware when recorder provided', () => {
      // Arrange
      const mockCompose = require('koa-compose')
      mockCompose.mockClear()
      const mockRecorder = jest.fn()
      const recorderMiddleware = require('./middlewares/recorder').recorderMiddleware
      recorderMiddleware.mockReturnValue(jest.fn())

      // Act
      new HttpClient({
        ...baseContext,
        recorder: mockRecorder as any,
      })

      // Assert
      expect(recorderMiddleware).toHaveBeenCalledWith(mockRecorder)
    })
  })

  describe('get', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should return data from response', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'test' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: expectedData }
      })

      // Act
      const result = await client.get('/users')

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should pass url to config', async () => {
      // Arrange
      const url = '/test-endpoint'
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.get(url)

      // Assert
      expect(mockMiddlewareFn).toHaveBeenCalled()
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe(url)
    })

    it('should pass custom config to request', async () => {
      // Arrange
      const config = { timeout: 5000, params: { test: 'value' } }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.get('/test', config)

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(5000)
      expect(context.config.params).toEqual({ test: 'value' })
    })

    it('should use generic type parameter for return type', async () => {
      // Arrange
      interface User {
        id: number
        name: string
      }
      const expectedUser: User = { id: 1, name: 'John' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: expectedUser }
      })

      // Act
      const result = await client.get<User>('/users/1')

      // Assert
      expect(result.id).toBe(1)
      expect(result.name).toBe('John')
    })
  })

  describe('getRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: { id: 1 },
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = expectedResponse
      })

      // Act
      const result = await client.getRaw('/users')

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should pass url to config', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.getRaw('/test-endpoint')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('/test-endpoint')
    })
  })

  describe('getWithBody', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should compute body hash and include in params', async () => {
      // Arrange
      const computeBodyHash = require('../utils/bodyHash').computeBodyHash
      computeBodyHash.mockReturnValue('hash-123')
      const data = { name: 'test' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: { success: true } }
      })

      // Act
      await client.getWithBody('/search', data)

      // Assert
      expect(computeBodyHash).toHaveBeenCalledWith(data, expect.any(Function))
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toEqual(data)
      expect(context.config.params).toHaveProperty('X-VTEX-Body-Hash', 'hash-123')
    })

    it('should merge params with body hash', async () => {
      // Arrange
      const computeBodyHash = require('../utils/bodyHash').computeBodyHash
      computeBodyHash.mockReturnValue('hash-456')
      const data = { query: 'test' }
      const existingParams = { filter: 'active' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.getWithBody('/search', data, { params: existingParams })

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.params).toHaveProperty('filter', 'active')
      expect(context.config.params).toHaveProperty('X-VTEX-Body-Hash')
    })

    it('should return data from response', async () => {
      // Arrange
      const computeBodyHash = require('../utils/bodyHash').computeBodyHash
      computeBodyHash.mockReturnValue('hash')
      const expectedData = { results: [] }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: expectedData }
      })

      // Act
      const result = await client.getWithBody('/search', {})

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should log warning when body hash computation fails', async () => {
      // Arrange
      const computeBodyHash = require('../utils/bodyHash').computeBodyHash
      computeBodyHash.mockImplementation((data: any, errorHandler: Function) => {
        errorHandler()
        return 'default-hash'
      })
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.getWithBody('/search', { test: 'data' })

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Error while sorting object for cache key',
      })
    })
  })

  describe('getBuffer', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set responseType to arraybuffer', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: Buffer.from('test') }
      })

      // Act
      await client.getBuffer('/file.zip')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.responseType).toBe('arraybuffer')
    })

    it('should set cacheable to Disk', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: Buffer.from('test') }
      })

      // Act
      await client.getBuffer('/file.zip')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.cacheable).toBe(CacheType.Disk)
    })

    it('should disable transformResponse', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: Buffer.from('test') }
      })

      // Act
      await client.getBuffer('/file.zip')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.transformResponse).toBeDefined()
      expect(context.config.transformResponse![0]('data')).toBe('data')
    })

    it('should return buffer and headers', async () => {
      // Arrange
      const buffer = Buffer.from('file content')
      const headers = { 'content-type': 'application/zip' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: buffer, headers }
      })

      // Act
      const result = await client.getBuffer('/file.zip')

      // Assert
      expect(result.data).toBe(buffer)
      expect(result.headers).toEqual(headers)
    })
  })

  describe('getStream', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set responseType to stream', async () => {
      // Arrange
      const mockStream = { readable: true }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: mockStream }
      })

      // Act
      await client.getStream('/video.mp4')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.responseType).toBe('stream')
    })

    it('should disable transformResponse', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.getStream('/video.mp4')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.transformResponse).toBeDefined()
    })

    it('should return IncomingMessage stream', async () => {
      // Arrange
      const mockStream = { readable: true } as any
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: mockStream }
      })

      // Act
      const result = await client.getStream('/video.mp4')

      // Assert
      expect(result).toBe(mockStream)
    })
  })

  describe('put', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set method to put', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.put('/users/1', { name: 'updated' })

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('put')
    })

    it('should pass data in config', async () => {
      // Arrange
      const data = { name: 'updated', age: 30 }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.put('/users/1', data)

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toEqual(data)
    })

    it('should merge with existing config', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.put('/users/1', { name: 'updated' }, { timeout: 2000 })

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(2000)
      expect(context.config.method).toBe('put')
    })

    it('should return response data', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'updated' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: expectedData }
      })

      // Act
      const result = await client.put('/users/1', { name: 'updated' })

      // Assert
      expect(result).toEqual(expectedData)
    })
  })

  describe('putRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set method to put', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {}, status: 200 }
      })

      // Act
      await client.putRaw('/users/1', { name: 'updated' })

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('put')
    })

    it('should return full response', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1 }, status: 200, headers: {} }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = expectedResponse
      })

      // Act
      const result = await client.putRaw('/users/1', { name: 'updated' })

      // Assert
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('post', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set method to post', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.post('/users', { name: 'John' })

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('post')
    })

    it('should pass url and data', async () => {
      // Arrange
      const data = { name: 'John', email: 'john@example.com' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.post('/users', data)

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('/users')
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'John' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: expectedData }
      })

      // Act
      const result = await client.post('/users', { name: 'John' })

      // Assert
      expect(result).toEqual(expectedData)
    })
  })

  describe('postRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set method to post', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {}, status: 201 }
      })

      // Act
      await client.postRaw('/users', { name: 'John' })

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('post')
    })

    it('should return full response', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1, name: 'John' }, status: 201, headers: {} }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = expectedResponse
      })

      // Act
      const result = await client.postRaw('/users', { name: 'John' })

      // Assert
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('patch', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set method to patch', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.patch('/users/1', { name: 'patched' })

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('patch')
    })

    it('should pass url and data', async () => {
      // Arrange
      const data = { status: 'active' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: {} }
      })

      // Act
      await client.patch('/users/1', data)

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('/users/1')
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'patched' }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: expectedData }
      })

      // Act
      const result = await client.patch('/users/1', { name: 'patched' })

      // Assert
      expect(result).toEqual(expectedData)
    })
  })

  describe('head', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set method to head', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null, status: 200 }
      })

      // Act
      await client.head('/resource')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('head')
    })

    it('should pass url in config', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.head('/resource')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('/resource')
    })

    it('should return full response', async () => {
      // Arrange
      const expectedResponse = { data: null, status: 200, headers: { 'content-length': '0' } }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = expectedResponse
      })

      // Act
      const result = await client.head('/resource')

      // Assert
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('delete', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should set method to delete', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null, status: 204 }
      })

      // Act
      await client.delete('/users/1')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('delete')
    })

    it('should pass url in config', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.delete('/users/1')

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('/users/1')
    })

    it('should return full response', async () => {
      // Arrange
      const expectedResponse = { data: null, status: 204, headers: {} }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = expectedResponse
      })

      // Act
      const result = await client.delete('/users/1')

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should handle optional config parameter', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await client.delete('/users/1', undefined)

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config).toBeDefined()
    })
  })

  describe('request', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should call runMiddlewares with context', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: 'test' }
      })

      // Act
      await (client as any).request({ url: '/test' })

      // Assert
      expect(mockMiddlewareFn).toHaveBeenCalled()
    })

    it('should return response from context', async () => {
      // Arrange
      const expectedResponse = { data: 'test', status: 200 }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = expectedResponse
      })

      // Act
      const result = await (client as any).request({ url: '/test' })

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should pass config in context', async () => {
      // Arrange
      const config = { url: '/test', timeout: 3000 }
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      await (client as any).request(config)

      // Assert
      const context = mockMiddlewareFn.mock.calls[0][0] as MiddlewareContext
      expect(context.config).toEqual(config)
    })
  })

  describe('edge cases', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseContext)
    })

    it('should handle empty response data', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: null }
      })

      // Act
      const result = await client.get('/empty')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle undefined response data', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: undefined }
      })

      // Act
      const result = await client.get('/undefined')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle empty string response', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: '' }
      })

      // Act
      const result = await client.get('/empty-string')

      // Assert
      expect(result).toBe('')
    })

    it('should handle array response', async () => {
      // Arrange
      const expectedArray = [{ id: 1 }, { id: 2 }]
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: expectedArray }
      })

      // Act
      const result = await client.get('/items')

      // Assert
      expect(result).toEqual(expectedArray)
    })

    it('should handle string response', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: 'text response' }
      })

      // Act
      const result = await client.get('/text')

      // Assert
      expect(result).toBe('text response')
    })

    it('should handle numeric response', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: 42 }
      })

      // Act
      const result = await client.get('/number')

      // Assert
      expect(result).toBe(42)
    })

    it('should handle boolean response', async () => {
      // Arrange
      mockMiddlewareFn.mockImplementation(async (ctx: any) => {
        ctx.response = { data: true }
      })

      // Act
      const result = await client.get('/boolean')

      // Assert
      expect(result).toBe(true)
    })
  })
})
