import { HttpClient } from './HttpClient'
import { MiddlewareContext, RequestConfig } from './typings'
import { CacheType } from './middlewares/cache'
import { Logger } from '../service/logger'
import { IOContext } from '../service/worker/runtime/typings'
import compose from 'koa-compose'
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
  let mockCompose: jest.MockedFunction<typeof compose>
  let mockPLimit: jest.MockedFunction<typeof pLimit>
  let mockComposedMiddleware: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as any

    mockComposedMiddleware = jest.fn()
    mockCompose = compose as jest.MockedFunction<typeof compose>
    mockCompose.mockReturnValue(mockComposedMiddleware as any)

    mockPLimit = pLimit as jest.MockedFunction<typeof pLimit>
    mockPLimit.mockReturnValue(jest.fn() as any)
  })

  describe('constructor', () => {
    // Arrange: Basic setup
    it('should initialize with minimal options', () => {
      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should use baseURL as name when provided', () => {
      const opts: IOContext & Partial<any> = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      const client = new HttpClient(opts)

      expect(client.name).toBe('https://api.example.com')
    })

    it('should use explicit name over baseURL', () => {
      const opts: IOContext & Partial<any> = {
        baseURL: 'https://api.example.com',
        name: 'CustomClient',
        logger: mockLogger,
      }

      const client = new HttpClient(opts)

      expect(client.name).toBe('CustomClient')
    })

    it('should set cacheableType to Memory by default', () => {
      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }

      const client = new HttpClient(opts)

      expect((client as any).cacheableType).toBe(CacheType.Memory)
    })

    it('should set cacheableType from options', () => {
      const opts: IOContext & Partial<any> = {
        cacheableType: CacheType.Disk,
        logger: mockLogger,
      }

      const client = new HttpClient(opts)

      expect((client as any).cacheableType).toBe(CacheType.Disk)
    })

    it('should set memoizable to true by default', () => {
      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }

      const client = new HttpClient(opts)

      expect((client as any).memoizable).toBe(true)
    })

    it('should set memoizable from options', () => {
      const opts: IOContext & Partial<any> = {
        memoizable: false,
        logger: mockLogger,
      }

      const client = new HttpClient(opts)

      expect((client as any).memoizable).toBe(false)
    })

    it('should create pLimit when concurrency is provided and greater than 0', () => {
      const opts: IOContext & Partial<any> = {
        concurrency: 5,
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockPLimit).toHaveBeenCalledWith(5)
    })

    it('should not create pLimit when concurrency is 0', () => {
      mockPLimit.mockClear()
      const opts: IOContext & Partial<any> = {
        concurrency: 0,
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should not create pLimit when concurrency is not provided', () => {
      mockPLimit.mockClear()
      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should build headers with default values', () => {
      const opts: IOContext & Partial<any> = {
        userAgent: 'TestAgent/1.0',
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockCompose).toHaveBeenCalled()
      const middlewares = (mockCompose as any).mock.calls[0][0]
      expect(middlewares).toBeDefined()
    })

    it('should include Authorization header when authType and authToken are provided', () => {
      const opts: IOContext & Partial<any> = {
        authType: 'Bearer',
        authToken: 'test-token-123',
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockCompose).toHaveBeenCalled()
    })

    it('should not include Authorization header when only authType is provided', () => {
      const opts: IOContext & Partial<any> = {
        authType: 'Bearer',
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockCompose).toHaveBeenCalled()
    })

    it('should not include Authorization header when only authToken is provided', () => {
      const opts: IOContext & Partial<any> = {
        authToken: 'test-token-123',
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include optional headers when provided', () => {
      const opts: IOContext & Partial<any> = {
        account: 'test-account',
        host: 'example.com',
        locale: 'en-US',
        operationId: 'op-123',
        product: 'test-product',
        segmentToken: 'segment-123',
        sessionToken: 'session-123',
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockCompose).toHaveBeenCalled()
    })

    it('should not include optional headers when not provided', () => {
      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockCompose).toHaveBeenCalled()
    })

    it('should call compose with middlewares array', () => {
      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }

      new HttpClient(opts)

      expect(mockCompose).toHaveBeenCalled()
      const middlewares = (mockCompose as any).mock.calls[0][0]
      expect(Array.isArray(middlewares)).toBe(true)
      expect(middlewares.length).toBeGreaterThan(0)
    })
  })

  describe('get method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { result: 'success' } } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return data from response', async () => {
      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should pass url to request config', async () => {
      // Act
      await client.get('/test-url')

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('/test-url')
    })

    it('should merge config with default cacheableType', async () => {
      // Act
      await client.get('/test', { timeout: 5000 })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(5000)
      expect(context.config.cacheable).toBe(CacheType.Memory)
    })

    it('should set memoizable in config', async () => {
      // Act
      await client.get('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.memoizable).toBe(true)
    })

    it('should handle generic type parameter', async () => {
      // Act
      const result = await client.get<{ custom: string }>('/test')

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should work with empty config', async () => {
      // Act
      const result = await client.get('/test', {})

      // Assert
      expect(result).toEqual({ result: 'success' })
    })
  })

  describe('getRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { result: 'success' }, status: 200, headers: {} } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Act
      const response = await client.getRaw('/test')

      // Assert
      expect(response).toEqual({ data: { result: 'success' }, status: 200, headers: {} })
    })

    it('should pass url to request config', async () => {
      // Act
      await client.getRaw('/test-url')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('/test-url')
    })

    it('should merge provided config', async () => {
      // Act
      await client.getRaw('/test', { timeout: 3000 })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(3000)
    })
  })

  describe('getWithBody method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { result: 'success' } } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should include data in request config', async () => {
      // Act
      const body = { key: 'value' }
      await client.getWithBody('/test', body)

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toEqual(body)
    })

    it('should compute body hash and include in params', async () => {
      // Act
      const body = { key: 'value' }
      await client.getWithBody('/test', body)

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.params).toBeDefined()
      expect(context.config.params['__bodyHash']).toBeDefined()
    })

    it('should merge config with body', async () => {
      // Act
      const body = { key: 'value' }
      await client.getWithBody('/test', body, { timeout: 5000 })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(5000)
      expect(context.config.data).toEqual(body)
    })

    it('should handle undefined body', async () => {
      // Act
      await client.getWithBody('/test', undefined)

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toBeUndefined()
    })

    it('should handle null body', async () => {
      // Act
      await client.getWithBody('/test', null)

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toBeNull()
    })

    it('should merge existing params with body hash', async () => {
      // Act
      const body = { key: 'value' }
      await client.getWithBody('/test', body, { params: { existing: 'param' } })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.params.existing).toBe('param')
      expect(context.config.params['__bodyHash']).toBeDefined()
    })

    it('should return data from response', async () => {
      // Act
      const result = await client.getWithBody('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ result: 'success' })
    })
  })

  describe('getBuffer method', () => {
    let client: HttpClient

    beforeEach(() => {
      const mockBuffer = Buffer.from('test')
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: mockBuffer, headers: {} } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set responseType to arraybuffer', async () => {
      // Act
      await client.getBuffer('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.responseType).toBe('arraybuffer')
    })

    it('should set cacheable to Disk', async () => {
      // Act
      await client.getBuffer('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.cacheable).toBe(CacheType.Disk)
    })

    it('should return buffer data', async () => {
      // Act
      const result = await client.getBuffer('/test')

      // Assert
      expect(result.data).toBeInstanceOf(Buffer)
    })

    it('should merge provided config', async () => {
      // Act
      await client.getBuffer('/test', { timeout: 10000 })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(10000)
    })
  })

  describe('getStream method', () => {
    let client: HttpClient
    let mockIncomingMessage: any

    beforeEach(() => {
      mockIncomingMessage = { on: jest.fn(), pipe: jest.fn() }
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: mockIncomingMessage } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set responseType to stream', async () => {
      // Act
      await client.getStream('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.responseType).toBe('stream')
    })

    it('should return IncomingMessage', async () => {
      // Act
      const result = await client.getStream('/test')

      // Assert
      expect(result).toBe(mockIncomingMessage)
    })

    it('should merge provided config', async () => {
      // Act
      await client.getStream('/test', { timeout: 30000 })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(30000)
    })
  })

  describe('put method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { updated: true } } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set method to put', async () => {
      // Act
      await client.put('/test', { key: 'value' })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('put')
    })

    it('should include data in config', async () => {
      // Act
      const data = { key: 'value' }
      await client.put('/test', data)

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Act
      const result = await client.put('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ updated: true })
    })

    it('should handle undefined data', async () => {
      // Act
      await client.put('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toBeUndefined()
    })
  })

  describe('putRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { updated: true }, status: 200 } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set method to put', async () => {
      // Act
      await client.putRaw('/test', { key: 'value' })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('put')
    })

    it('should return full response', async () => {
      // Act
      const response = await client.putRaw('/test', { key: 'value' })

      // Assert
      expect(response).toEqual({ data: { updated: true }, status: 200 })
    })
  })

  describe('post method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { created: true } } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set method to post', async () => {
      // Act
      await client.post('/test', { key: 'value' })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('post')
    })

    it('should include data in config', async () => {
      // Act
      const data = { key: 'value' }
      await client.post('/test', data)

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Act
      const result = await client.post('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ created: true })
    })

    it('should handle undefined data', async () => {
      // Act
      await client.post('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toBeUndefined()
    })
  })

  describe('postRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { created: true }, status: 201 } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set method to post', async () => {
      // Act
      await client.postRaw('/test', { key: 'value' })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('post')
    })

    it('should return full response', async () => {
      // Act
      const response = await client.postRaw('/test', { key: 'value' })

      // Assert
      expect(response).toEqual({ data: { created: true }, status: 201 })
    })
  })

  describe('patch method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { patched: true } } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set method to patch', async () => {
      // Act
      await client.patch('/test', { key: 'value' })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('patch')
    })

    it('should include data in config', async () => {
      // Act
      const data = { key: 'value' }
      await client.patch('/test', data)

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.data).toEqual(data)
    })

    it('should return response data', async () => {
      // Act
      const result = await client.patch('/test', { key: 'value' })

      // Assert
      expect(result).toEqual({ patched: true })
    })
  })

  describe('head method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { status: 200, headers: {} } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set method to head', async () => {
      // Act
      await client.head('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('head')
    })

    it('should return full response', async () => {
      // Act
      const response = await client.head('/test')

      // Assert
      expect(response).toEqual({ status: 200, headers: {} })
    })
  })

  describe('delete method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { status: 204 } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should set method to delete', async () => {
      // Act
      await client.delete('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('delete')
    })

    it('should return full response', async () => {
      // Act
      const response = await client.delete('/test')

      // Assert
      expect(response).toEqual({ status: 204 })
    })

    it('should handle undefined config', async () => {
      // Act
      await client.delete('/test')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.method).toBe('delete')
    })

    it('should handle provided config', async () => {
      // Act
      await client.delete('/test', { timeout: 5000 })

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.timeout).toBe(5000)
    })
  })

  describe('request method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: 'success', status: 200 } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should invoke runMiddlewares with context', async () => {
      // Act
      const config: RequestConfig = { url: '/test' }
      await (client as any).request(config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          config,
        })
      )
    })

    it('should return response from context', async () => {
      // Act
      const config: RequestConfig = { url: '/test' }
      const result = await (client as any).request(config)

      // Assert
      expect(result).toEqual({ data: 'success', status: 200 })
    })

    it('should await middlewares execution', async () => {
      // Arrange
      let middlewareExecuted = false
      mockComposedMiddleware.mockImplementation(async () => {
        middlewareExecuted = true
        return Promise.resolve()
      })

      // Act
      const config: RequestConfig = { url: '/test' }
      await (client as any).request(config)

      // Assert
      expect(middlewareExecuted).toBe(true)
    })
  })

  describe('getConfig method', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {} as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return config with cacheable and memoizable', async () => {
      // Act
      const result = (client as any).getConfig('/test')

      // Assert
      expect(result.cacheable).toBe(CacheType.Memory)
      expect(result.memoizable).toBe(true)
      expect(result.url).toBe('/test')
    })

    it('should merge provided config', async () => {
      // Act
      const result = (client as any).getConfig('/test', { timeout: 5000 })

      // Assert
      expect(result.timeout).toBe(5000)
      expect(result.cacheable).toBe(CacheType.Memory)
    })

    it('should use provided cacheable type', async () => {
      // Arrange
      const opts: IOContext & Partial<any> = {
        cacheableType: CacheType.Disk,
        logger: mockLogger,
      }
      client = new HttpClient(opts)

      // Act
      const result = (client as any).getConfig('/test')

      // Assert
      expect(result.cacheable).toBe(CacheType.Disk)
    })

    it('should use provided memoizable value', async () => {
      // Arrange
      const opts: IOContext & Partial<any> = {
        memoizable: false,
        logger: mockLogger,
      }
      client = new HttpClient(opts)

      // Act
      const result = (client as any).getConfig('/test')

      // Assert
      expect(result.memoizable).toBe(false)
    })

    it('should preserve custom config properties', async () => {
      // Act
      const customConfig = { timeout: 10000, retry: 3, custom: 'value' }
      const result = (client as any).getConfig('/test', customConfig)

      // Assert
      expect(result.timeout).toBe(10000)
      expect(result.retry).toBe(3)
      expect(result.custom).toBe('value')
    })
  })

  describe('edge cases and error handling', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: null } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should handle response with null data', async () => {
      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle response with undefined data', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: undefined } as any
      })

      // Act
      const result = await client.get('/test')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle empty URL', async () => {
      // Act
      await client.get('')

      // Assert
      const context = (mockComposedMiddleware as any).mock.calls[0][0] as MiddlewareContext
      expect(context.config.url).toBe('')
    })

    it('should handle middleware error propagation', async () => {
      // Arrange
      const error = new Error('Middleware error')
      mockComposedMiddleware.mockRejectedValueOnce(error)

      // Act & Assert
      await expect(client.get('/test')).rejects.toThrow('Middleware error')
    })

    it('should handle very large concurrency values', () => {
      // Arrange
      mockPLimit.mockClear()

      // Act
      new HttpClient({
        concurrency: 1000000,
        logger: mockLogger,
      })

      // Assert
      expect(mockPLimit).toHaveBeenCalledWith(1000000)
    })

    it('should handle negative concurrency value', () => {
      // Arrange
      mockPLimit.mockClear()

      // Act
      new HttpClient({
        concurrency: -5,
        logger: mockLogger,
      })

      // Assert
      expect(mockPLimit).not.toHaveBeenCalled()
    })
  })

  describe('multiple client instances', () => {
    it('should create independent instances with different names', () => {
      // Act
      const client1 = new HttpClient({
        name: 'Client1',
        logger: mockLogger,
      })
      const client2 = new HttpClient({
        name: 'Client2',
        logger: mockLogger,
      })

      // Assert
      expect(client1.name).toBe('Client1')
      expect(client2.name).toBe('Client2')
    })

    it('should create independent instances with different cache types', () => {
      // Act
      const client1 = new HttpClient({
        cacheableType: CacheType.Memory,
        logger: mockLogger,
      })
      const client2 = new HttpClient({
        cacheableType: CacheType.Disk,
        logger: mockLogger,
      })

      // Assert
      expect((client1 as any).cacheableType).toBe(CacheType.Memory)
      expect((client2 as any).cacheableType).toBe(CacheType.Disk)
    })
  })

  describe('generic type support', () => {
    let client: HttpClient

    beforeEach(() => {
      mockComposedMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = { data: { id: 1, name: 'test' } } as any
      })

      const opts: IOContext & Partial<any> = {
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should support generic type in get', async () => {
      // Act
      interface User {
        id: number
        name: string
      }
      const result = await client.get<User>('/users/1')

      // Assert
      expect(result).toEqual({ id: 1, name: 'test' })
    })

    it('should support generic type in getRaw', async () => {
      // Act
      interface User {
        id: number
        name: string
      }
      const result = await client.getRaw<User>('/users/1')

      // Assert
      expect(result.data).toEqual({ id: 1, name: 'test' })
    })
  })
})
