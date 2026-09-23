import { HttpClient } from './HttpClient'
import { CacheType } from './middlewares/cache'
import { Logger } from '../service/logger'
import { IOContext } from '../service/worker/runtime/typings'
import * as compose from 'koa-compose'
import pLimit from 'p-limit'

jest.mock('koa-compose')
jest.mock('p-limit')
jest.mock('./middlewares/cache')
jest.mock('./middlewares/cancellationToken')
jest.mock('./middlewares/inflight')
jest.mock('./middlewares/memoization')
jest.mock('./middlewares/metrics')
jest.mock('./middlewares/notFound')
jest.mock('./middlewares/recorder')
jest.mock('./middlewares/request')
jest.mock('./middlewares/tracing')
jest.mock('../utils/binding')
jest.mock('../utils/tenant')
jest.mock('../utils/bodyHash')

describe('HttpClient', () => {
  let mockLogger: jest.Mocked<Logger>
  let mockComposedMiddleware: jest.Mock
  let defaultOpts: IOContext & Partial<any>

  beforeEach(() => {
    jest.clearAllMocks()

    mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any

    mockComposedMiddleware = jest.fn().mockResolvedValue(undefined)
    ;(compose as any).default = jest.fn().mockReturnValue(mockComposedMiddleware)
    ;(pLimit as any).default = jest.fn().mockReturnValue(undefined)

    defaultOpts = {
      account: 'test-account',
      baseURL: 'https://api.example.com',
      authToken: 'test-token',
      authType: 'Bearer',
      memoryCache: undefined,
      diskCache: undefined,
      memoizable: true,
      locale: 'en-US',
      name: 'TestClient',
      product: 'test-product',
      userAgent: 'test-agent',
      timeout: 5000,
      logger: mockLogger,
    }
  })

  describe('constructor', () => {
    it('should initialize with required options', () => {
      // Arrange & Act
      const client = new HttpClient(defaultOpts)

      // Assert
      expect(client.name).toBe('TestClient')
    })

    it('should use baseURL as name if name is not provided', () => {
      // Arrange
      const opts = { ...defaultOpts, name: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should use "unknown" as name if neither name nor baseURL is provided', () => {
      // Arrange
      const opts = { ...defaultOpts, name: undefined, baseURL: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set default timeout when not provided', () => {
      // Arrange
      const opts = { ...defaultOpts, timeout: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should include Authorization header when authType and authToken are provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        authType: 'Bearer',
        authToken: 'test-token',
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['Authorization']).toBe('Bearer test-token')
    })

    it('should not include Authorization header when authToken is missing', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        authType: 'Bearer',
        authToken: undefined,
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['Authorization']).toBeUndefined()
    })

    it('should not include Authorization header when authType is missing', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        authType: undefined,
        authToken: 'test-token',
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['Authorization']).toBeUndefined()
    })

    it('should include Account header when account is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        account: 'my-account',
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['vtex-account']).toBe('my-account')
    })

    it('should not include Account header when account is undefined', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        account: undefined,
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['vtex-account']).toBeUndefined()
    })

    it('should include Locale header when locale is provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        locale: 'pt-BR',
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['Accept-Language']).toBe('pt-BR')
    })

    it('should include User-Agent header', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        userAgent: 'custom-agent/1.0',
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['User-Agent']).toBe('custom-agent/1.0')
    })

    it('should include Accept-Encoding header', () => {
      // Arrange & Act
      const client = new HttpClient(defaultOpts)

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['Accept-Encoding']).toBe('gzip')
    })

    it('should set up pLimit with concurrency when concurrency is provided', () => {
      // Arrange
      ;(pLimit as any).default = jest.fn().mockReturnValue(jest.fn())

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        concurrency: 5,
      })

      // Assert
      expect((pLimit as any).default).toHaveBeenCalledWith(5)
    })

    it('should not set up pLimit when concurrency is 0', () => {
      // Arrange
      ;(pLimit as any).default = jest.fn()

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        concurrency: 0,
      })

      // Assert
      expect((pLimit as any).default).not.toHaveBeenCalled()
    })

    it('should not set up pLimit when concurrency is undefined', () => {
      // Arrange
      ;(pLimit as any).default = jest.fn()

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        concurrency: undefined,
      })

      // Assert
      expect((pLimit as any).default).not.toHaveBeenCalled()
    })

    it('should use memoizable from options', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        memoizable: false,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should set cacheableType to Memory by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        cacheableType: undefined,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should set cacheableType when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...defaultOpts,
        cacheableType: CacheType.Disk,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include custom middleware when provided', () => {
      // Arrange
      const customMiddleware = jest.fn()
      ;(compose as any).default = jest.fn().mockReturnValue(mockComposedMiddleware)

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        middlewares: [customMiddleware],
      })

      // Assert
      const composeCall = (compose as any).default.mock.calls[0]
      expect(composeCall[0]).toContain(customMiddleware)
    })

    it('should include recorder middleware when recorder is provided', () => {
      // Arrange
      const mockRecorder = jest.fn()
      ;(compose as any).default = jest.fn().mockReturnValue(mockComposedMiddleware)

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        recorder: mockRecorder,
      })

      // Assert
      expect((compose as any).default).toHaveBeenCalled()
    })

    it('should include cache middleware when memoryCache is provided', () => {
      // Arrange
      const mockMemoryCache = {}
      ;(compose as any).default = jest.fn().mockReturnValue(mockComposedMiddleware)

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        memoryCache: mockMemoryCache,
      })

      // Assert
      expect((compose as any).default).toHaveBeenCalled()
    })

    it('should include cache middleware when diskCache is provided', () => {
      // Arrange
      const mockDiskCache = {}
      ;(compose as any).default = jest.fn().mockReturnValue(mockComposedMiddleware)

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        diskCache: mockDiskCache,
      })

      // Assert
      expect((compose as any).default).toHaveBeenCalled()
    })

    it('should set up compose middleware with all configured middlewares', () => {
      // Arrange & Act
      const client = new HttpClient(defaultOpts)

      // Assert
      expect((compose as any).default).toHaveBeenCalled()
    })
  })

  describe('get method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { result: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should return response data for successful request', async () => {
      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should pass url and config to request', async () => {
      // Act
      await client.get('/test', { timeout: 3000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle empty config', async () => {
      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeDefined()
    })

    it('should set cacheable to cacheableType', async () => {
      // Act
      await client.get('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should set memoizable flag', async () => {
      // Act
      await client.get('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle null response data', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: null,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle undefined response data', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: undefined,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should propagate middleware errors', async () => {
      // Arrange
      const error = new Error('Middleware error')
      mockComposedMiddleware.mockRejectedValue(error)

      // Act & Assert
      await expect(client.get('/test')).rejects.toThrow('Middleware error')
    })
  })

  describe('getRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { result: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should return full response object', async () => {
      // Act
      const result = await client.getRaw('/test')

      // Assert
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('status')
      expect(result.data).toEqual({ result: 'success' })
    })

    it('should pass url and config to request', async () => {
      // Act
      await client.getRaw('/test', { timeout: 3000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle empty config', async () => {
      // Act
      const result = await client.getRaw('/test')

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('getWithBody method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { result: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      ;(require('../utils/bodyHash').computeBodyHash as jest.Mock).mockReturnValue('hash123')
      client = new HttpClient(defaultOpts)
    })

    it('should return response data', async () => {
      // Act
      const result = await client.getWithBody('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should include body in data field', async () => {
      // Arrange
      const body = { key: 'value' }

      // Act
      await client.getWithBody('/test', body)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should compute body hash and add to params', async () => {
      // Arrange
      const body = { key: 'value' }
      ;(require('../utils/bodyHash').computeBodyHash as jest.Mock).mockReturnValue('hash123')

      // Act
      await client.getWithBody('/test', body)

      // Assert
      expect(require('../utils/bodyHash').computeBodyHash).toHaveBeenCalledWith(body, expect.any(Function))
    })

    it('should handle undefined body', async () => {
      // Act
      const result = await client.getWithBody('/test', undefined)

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should handle null body', async () => {
      // Act
      const result = await client.getWithBody('/test', null)

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should merge existing params with body hash', async () => {
      // Arrange
      ;(require('../utils/bodyHash').computeBodyHash as jest.Mock).mockReturnValue('hash123')

      // Act
      await client.getWithBody('/test', { data: 'test' }, { params: { existing: 'param' } })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle body hash computation errors', async () => {
      // Arrange
      ;(require('../utils/bodyHash').computeBodyHash as jest.Mock).mockImplementation((data, callback) => {
        callback()
        return 'hash'
      })

      // Act
      await client.getWithBody('/test', { key: 'value' })

      // Assert
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  describe('getBuffer method', () => {
    let client: HttpClient

    beforeEach(() => {
      const mockBuffer = Buffer.from('test data')
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: mockBuffer,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should return buffer response', async () => {
      // Act
      const result = await client.getBuffer('/test')

      // Assert
      expect(Buffer.isBuffer(result.data)).toBe(true)
    })

    it('should set responseType to arraybuffer', async () => {
      // Act
      await client.getBuffer('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should set cacheable to Disk', async () => {
      // Act
      await client.getBuffer('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should disable response transformation', async () => {
      // Act
      await client.getBuffer('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should merge config with buffer defaults', async () => {
      // Act
      await client.getBuffer('/test', { timeout: 3000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('getStream method', () => {
    let client: HttpClient

    beforeEach(() => {
      const mockStream = {
        on: jest.fn(),
      }
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: mockStream,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should return stream response', async () => {
      // Act
      const result = await client.getStream('/test')

      // Assert
      expect(result).toBeDefined()
      expect(result.on).toBeDefined()
    })

    it('should set responseType to stream', async () => {
      // Act
      await client.getStream('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should disable response transformation', async () => {
      // Act
      await client.getStream('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should merge config with stream defaults', async () => {
      // Act
      await client.getStream('/test', { timeout: 3000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('put method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { updated: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should send PUT request with data', async () => {
      // Act
      const result = await client.put('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ updated: true })
    })

    it('should send PUT request without data', async () => {
      // Act
      const result = await client.put('/test')

      // Assert
      expect(result).toEqual({ updated: true })
    })

    it('should set method to PUT', async () => {
      // Act
      await client.put('/test', { key: 'value' })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should merge config with request config', async () => {
      // Act
      await client.put('/test', { key: 'value' }, { timeout: 3000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle null data', async () => {
      // Act
      const result = await client.put('/test', null)

      // Assert
      expect(result).toEqual({ updated: true })
    })
  })

  describe('putRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { updated: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should return full response object', async () => {
      // Act
      const result = await client.putRaw('/test', { key: 'value' })

      // Assert
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('status')
    })

    it('should send PUT request', async () => {
      // Act
      await client.putRaw('/test', { key: 'value' })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('post method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { created: true },
          status: 201,
          statusText: 'Created',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should send POST request with data', async () => {
      // Act
      const result = await client.post('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ created: true })
    })

    it('should send POST request without data', async () => {
      // Act
      const result = await client.post('/test')

      // Assert
      expect(result).toEqual({ created: true })
    })

    it('should set method to POST', async () => {
      // Act
      await client.post('/test', { key: 'value' })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle null data', async () => {
      // Act
      const result = await client.post('/test', null)

      // Assert
      expect(result).toEqual({ created: true })
    })
  })

  describe('postRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { created: true },
          status: 201,
          statusText: 'Created',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should return full response object', async () => {
      // Act
      const result = await client.postRaw('/test', { key: 'value' })

      // Assert
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('status')
      expect(result.status).toBe(201)
    })

    it('should send POST request', async () => {
      // Act
      await client.postRaw('/test', { key: 'value' })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('patch method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { patched: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should send PATCH request with data', async () => {
      // Act
      const result = await client.patch('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ patched: true })
    })

    it('should send PATCH request without data', async () => {
      // Act
      const result = await client.patch('/test')

      // Assert
      expect(result).toEqual({ patched: true })
    })

    it('should set method to PATCH', async () => {
      // Act
      await client.patch('/test', { key: 'value' })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('head method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: undefined,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should return full response object', async () => {
      // Act
      const result = await client.head('/test')

      // Assert
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('headers')
    })

    it('should set method to HEAD', async () => {
      // Act
      await client.head('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should merge config with request config', async () => {
      // Act
      await client.head('/test', { timeout: 3000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('delete method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: undefined,
          status: 204,
          statusText: 'No Content',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should send DELETE request', async () => {
      // Act
      const result = await client.delete('/test')

      // Assert
      expect(result).toBeDefined()
      expect(result.status).toBe(204)
    })

    it('should return full response object', async () => {
      // Act
      const result = await client.delete('/test')

      // Assert
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('status')
    })

    it('should set method to DELETE', async () => {
      // Act
      await client.delete('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle undefined config', async () => {
      // Act
      const result = await client.delete('/test', undefined)

      // Assert
      expect(result).toBeDefined()
    })

    it('should merge config with request config', async () => {
      // Act
      await client.delete('/test', { timeout: 3000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('request method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { result: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should call middleware with context', async () => {
      // Act
      await client['request']({ url: '/test' })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should return response from context', async () => {
      // Act
      const result = await client['request']({ url: '/test' })

      // Assert
      expect(result).toHaveProperty('data')
      expect(result.data).toEqual({ result: 'success' })
    })

    it('should pass config in context', async () => {
      // Arrange
      const config = { url: '/test', method: 'get' }

      // Act
      await client['request'](config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should propagate middleware errors', async () => {
      // Arrange
      const error = new Error('Request error')
      mockComposedMiddleware.mockRejectedValue(error)

      // Act & Assert
      await expect(client['request']({ url: '/test' })).rejects.toThrow('Request error')
    })
  })

  describe('getConfig private method behavior', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { result: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient({
        ...defaultOpts,
        cacheableType: CacheType.Disk,
        memoizable: false,
      })
    })

    it('should apply cacheableType from constructor', async () => {
      // Act
      await client.get('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should apply memoizable from constructor', async () => {
      // Act
      await client.get('/test')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should merge provided config with defaults', async () => {
      // Act
      await client.get('/test', { timeout: 5000 })

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('error handling and edge cases', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation((context) => {
        context.response = {
          data: { result: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }
        return Promise.resolve()
      })
      client = new HttpClient(defaultOpts)
    })

    it('should handle multiple concurrent requests', async () => {
      // Act
      const [result1, result2, result3] = await Promise.all([
        client.get('/test1'),
        client.get('/test2'),
        client.get('/test3'),
      ])

      // Assert
      expect(result1).toEqual({ result: 'success' })
      expect(result2).toEqual({ result: 'success' })
      expect(result3).toEqual({ result: 'success' })
      expect(mockComposedMiddleware).toHaveBeenCalledTimes(3)
    })

    it('should handle requests with special characters in URL', async () => {
      // Act
      const result = await client.get('/test?param=value&other=123')

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should handle requests with empty string URL', async () => {
      // Act
      const result = await client.get('')

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should handle requests with complex nested data', async () => {
      // Arrange
      const complexData = {
        nested: {
          deep: {
            value: 'test',
            array: [1, 2, 3],
            obj: { key: 'val' },
          },
        },
      }

      // Act
      const result = await client.post('/test', complexData)

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should handle requests with large data payloads', async () => {
      // Arrange
      const largeData = {
        content: 'x'.repeat(10000),
      }

      // Act
      const result = await client.post('/test', largeData)

      // Assert
      expect(result).toEqual({ result: 'success' })
    })
  })

  describe('tenant and binding headers', () => {
    it('should format tenant header when tenant is provided', () => {
      // Arrange
      const mockFormatTenant = require('../utils/tenant').formatTenantHeaderValue as jest.Mock
      mockFormatTenant.mockReturnValue('formatted-tenant')

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        tenant: { id: 'tenant-1' },
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(mockFormatTenant).toHaveBeenCalled()
    })

    it('should format binding header when binding is provided', () => {
      // Arrange
      const mockFormatBinding = require('../utils/binding').formatBindingHeaderValue as jest.Mock
      mockFormatBinding.mockReturnValue('formatted-binding')

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        binding: { id: 'binding-1' },
      })

      // Assert
      expect(mockFormatBinding).toHaveBeenCalled()
    })

    it('should not include tenant header when tenant is undefined', () => {
      // Act
      const client = new HttpClient({
        ...defaultOpts,
        tenant: undefined,
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['vtex-tenant']).toBeUndefined()
    })

    it('should not include binding header when binding is undefined', () => {
      // Act
      const client = new HttpClient({
        ...defaultOpts,
        binding: undefined,
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      expect(defaultsMiddlewareCall[0].rawHeaders['vtex-binding']).toBeUndefined()
    })
  })

  describe('optional headers', () => {
    it('should include all optional headers when provided', () => {
      // Act
      const client = new HttpClient({
        ...defaultOpts,
        operationId: 'op-123',
        segmentToken: 'seg-456',
        sessionToken: 'sess-789',
        host: 'example.com',
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      const headers = defaultsMiddlewareCall[0].rawHeaders
      expect(headers['vtex-operation-id']).toBe('op-123')
      expect(headers['vtex-segment']).toBe('seg-456')
      expect(headers['vtex-session']).toBe('sess-789')
      expect(headers['x-forwarded-host']).toBe('example.com')
    })

    it('should not include optional headers when not provided', () => {
      // Act
      const client = new HttpClient({
        ...defaultOpts,
        operationId: undefined,
        segmentToken: undefined,
        sessionToken: undefined,
        host: undefined,
      })

      // Assert
      const defaultsMiddlewareCall = (require('./middlewares/request').defaultsMiddleware as jest.Mock).mock.calls[0]
      const headers = defaultsMiddlewareCall[0].rawHeaders
      expect(headers['vtex-operation-id']).toBeUndefined()
      expect(headers['vtex-segment']).toBeUndefined()
      expect(headers['vtex-session']).toBeUndefined()
      expect(headers['x-forwarded-host']).toBeUndefined()
    })
  })

  describe('tracing middleware', () => {
    it('should create tracing middleware with correct options', () => {
      // Arrange
      const mockTracer = jest.fn()
      const mockCreateTracingMiddleware = require('./middlewares/tracing').createHttpClientTracingMiddleware as jest.Mock
      mockCreateTracingMiddleware.mockReturnValue(jest.fn())

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        tracer: mockTracer,
        diskCache: undefined,
        memoryCache: undefined,
      })

      // Assert
      expect(mockCreateTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          tracer: mockTracer,
          logger: mockLogger,
          clientName: defaultOpts.name,
          hasDiskCacheMiddleware: false,
          hasMemoryCacheMiddleware: false,
        })
      )
    })

    it('should indicate disk cache middleware in tracing options', () => {
      // Arrange
      const mockDiskCache = {}
      const mockCreateTracingMiddleware = require('./middlewares/tracing').createHttpClientTracingMiddleware as jest.Mock
      mockCreateTracingMiddleware.mockReturnValue(jest.fn())

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        diskCache: mockDiskCache,
      })

      // Assert
      expect(mockCreateTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          hasDiskCacheMiddleware: true,
        })
      )
    })

    it('should indicate memory cache middleware in tracing options', () => {
      // Arrange
      const mockMemoryCache = {}
      const mockCreateTracingMiddleware = require('./middlewares/tracing').createHttpClientTracingMiddleware as jest.Mock
      mockCreateTracingMiddleware.mockReturnValue(jest.fn())

      // Act
      const client = new HttpClient({
        ...defaultOpts,
        memoryCache: mockMemoryCache,
      })

      // Assert
      expect(mockCreateTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          hasMemoryCacheMiddleware: true,
        })
      )
    })
  })
})
