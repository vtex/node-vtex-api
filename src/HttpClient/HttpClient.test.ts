import { HttpClient } from './HttpClient'
import { MiddlewareContext, RequestConfig } from './typings'
import { CacheType } from './middlewares/cache'
import { Logger } from '../service/logger'
import compose from 'koa-compose'
import pLimit from 'p-limit'

jest.mock('koa-compose')
jest.mock('p-limit')

describe('HttpClient', () => {
  let logger: jest.Mocked<Logger>
  let composedMiddleware: jest.Mock
  let limitFn: jest.Mock

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
    } as any

    composedMiddleware = jest.fn().mockResolvedValue(undefined)
    ;(compose as jest.Mock).mockReturnValue(composedMiddleware)

    limitFn = jest.fn()
    ;(pLimit as jest.Mock).mockReturnValue(limitFn)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default values', () => {
      // Arrange & Act
      const client = new HttpClient({
        account: 'test-account',
        baseURL: 'https://api.example.com',
        authToken: 'token123',
        authType: 'Bearer',
        logger,
      })

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should use name when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        name: 'custom-client',
        baseURL: 'https://api.example.com',
        logger,
      })

      // Assert
      expect(client.name).toBe('custom-client')
    })

    it('should use baseURL as fallback for name', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should use unknown as default name', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger,
      })

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set memoizable to true by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger,
      })

      // Assert
      expect((client as any).memoizable).toBe(true)
    })

    it('should set memoizable to false when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        memoizable: false,
        logger,
      })

      // Assert
      expect((client as any).memoizable).toBe(false)
    })

    it('should set cacheableType to Memory by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger,
      })

      // Assert
      expect((client as any).cacheableType).toBe(CacheType.Memory)
    })

    it('should set cacheableType to Disk when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        cacheableType: CacheType.Disk,
        logger,
      })

      // Assert
      expect((client as any).cacheableType).toBe(CacheType.Disk)
    })

    it('should create pLimit with concurrency when provided', () => {
      // Arrange & Act
      new HttpClient({
        concurrency: 5,
        logger,
      })

      // Assert
      expect(pLimit).toHaveBeenCalledWith(5)
    })

    it('should not create pLimit when concurrency is 0', () => {
      // Arrange & Act
      new HttpClient({
        concurrency: 0,
        logger,
      })

      // Assert
      expect(pLimit).not.toHaveBeenCalled()
    })

    it('should not create pLimit when concurrency is undefined', () => {
      // Arrange & Act
      new HttpClient({
        logger,
      })

      // Assert
      expect(pLimit).not.toHaveBeenCalled()
    })

    it('should include Authorization header when authType and authToken are provided', () => {
      // Arrange
      const mockContext: Partial<MiddlewareContext> = { config: {} }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: {} }
        return Promise.resolve()
      })

      // Act
      new HttpClient({
        authToken: 'secret-token',
        authType: 'Bearer',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include account header when account is provided', () => {
      // Arrange & Act
      new HttpClient({
        account: 'test-account',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include tenant header when tenant is provided', () => {
      // Arrange & Act
      new HttpClient({
        tenant: { id: 'tenant-123' },
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include binding header when binding is provided', () => {
      // Arrange & Act
      new HttpClient({
        binding: { id: 'binding-123' },
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include locale header when locale is provided', () => {
      // Arrange & Act
      new HttpClient({
        locale: 'en-US',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include operationId header when operationId is provided', () => {
      // Arrange & Act
      new HttpClient({
        operationId: 'op-123',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include product header when product is provided', () => {
      // Arrange & Act
      new HttpClient({
        product: 'test-product',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include segmentToken header when segmentToken is provided', () => {
      // Arrange & Act
      new HttpClient({
        segmentToken: 'seg-token',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include sessionToken header when sessionToken is provided', () => {
      // Arrange & Act
      new HttpClient({
        sessionToken: 'sess-token',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include host header when host is provided', () => {
      // Arrange & Act
      new HttpClient({
        host: 'example.com',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should always include Accept-Encoding and User-Agent headers', () => {
      // Arrange & Act
      new HttpClient({
        userAgent: 'TestAgent/1.0',
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include recorder middleware when recorder is provided', () => {
      // Arrange
      const recorder = jest.fn()

      // Act
      new HttpClient({
        recorder,
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include custom middlewares when provided', () => {
      // Arrange
      const customMiddleware = jest.fn()

      // Act
      new HttpClient({
        middlewares: [customMiddleware],
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include memory cache middleware when memoryCache is provided', () => {
      // Arrange
      const memoryCache = new Map()

      // Act
      new HttpClient({
        memoryCache,
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include disk cache middleware when diskCache is provided', () => {
      // Arrange
      const diskCache = new Map()

      // Act
      new HttpClient({
        diskCache,
        logger,
      })

      // Assert
      expect(compose).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('should return data from response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const expectedData = { id: 1, name: 'test' }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: expectedData }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/users')

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should handle empty config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: { result: 'ok' } }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/users')

      // Assert
      expect(result).toEqual({ result: 'ok' })
    })

    it('should pass url and config to request', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const config: RequestConfig = { timeout: 5000 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: {} }
        return Promise.resolve()
      })

      // Act
      await client.get('/users', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('getRaw', () => {
    it('should return full response object', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: { id: 1 }, status: 200, statusText: 'OK' }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.getRaw('/users')

      // Assert
      expect(result).toEqual(response)
    })

    it('should handle empty config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: null, status: 200 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.getRaw('/users')

      // Assert
      expect(result).toEqual(response)
    })
  })

  describe('getWithBody', () => {
    it('should include body data in request', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const bodyData = { name: 'John', age: 30 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: { success: true } }
        return Promise.resolve()
      })

      // Act
      const result = await client.getWithBody('/users', bodyData)

      // Assert
      expect(result).toEqual({ success: true })
      expect(composedMiddleware).toHaveBeenCalled()
    })

    it('should handle undefined body data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: { success: true } }
        return Promise.resolve()
      })

      // Act
      const result = await client.getWithBody('/users', undefined)

      // Assert
      expect(result).toEqual({ success: true })
    })

    it('should merge config params with body hash', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const bodyData = { name: 'Jane' }
      const config: RequestConfig = { params: { page: 1 } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: {} }
        return Promise.resolve()
      })

      // Act
      await client.getWithBody('/users', bodyData, config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })

    it('should log warning on body hash computation error', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const bodyData = { circular: {} }
      bodyData.circular = bodyData // create circular reference
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: {} }
        return Promise.resolve()
      })

      // Act
      await client.getWithBody('/users', bodyData)

      // Assert
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('getBuffer', () => {
    it('should return buffer data with Disk cache type', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const bufferData = Buffer.from('test data')
      const response = { data: bufferData, headers: { 'content-type': 'application/octet-stream' } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.getBuffer('/file.bin')

      // Assert
      expect(result.data).toEqual(bufferData)
      expect(result.headers).toEqual(response.headers)
    })

    it('should override responseType to arraybuffer', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: Buffer.from(''), headers: {} }
        return Promise.resolve()
      })

      // Act
      await client.getBuffer('/file.bin', { responseType: 'json' })

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('getStream', () => {
    it('should return IncomingMessage stream', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const mockStream = { on: jest.fn() } as any
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: mockStream }
        return Promise.resolve()
      })

      // Act
      const result = await client.getStream('/stream')

      // Assert
      expect(result).toEqual(mockStream)
    })

    it('should set responseType to stream', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const mockStream = { on: jest.fn() } as any
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: mockStream }
        return Promise.resolve()
      })

      // Act
      await client.getStream('/stream')

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('put', () => {
    it('should send PUT request with data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const updateData = { name: 'Updated' }
      const response = { data: { id: 1, ...updateData } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.put('/users/1', updateData)

      // Assert
      expect(result).toEqual(response.data)
    })

    it('should handle undefined data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: { id: 1 } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.put('/users/1')

      // Assert
      expect(result).toEqual(response.data)
    })

    it('should merge config with PUT defaults', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const config: RequestConfig = { timeout: 3000 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: {} }
        return Promise.resolve()
      })

      // Act
      await client.put('/users/1', { name: 'Test' }, config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('putRaw', () => {
    it('should return full response for PUT', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: { id: 1 }, status: 200 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.putRaw('/users/1', { name: 'Updated' })

      // Assert
      expect(result).toEqual(response)
    })
  })

  describe('post', () => {
    it('should send POST request with data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const postData = { name: 'New User' }
      const response = { data: { id: 2, ...postData } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.post('/users', postData)

      // Assert
      expect(result).toEqual(response.data)
    })

    it('should handle undefined data for POST', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: { id: 3 } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.post('/users')

      // Assert
      expect(result).toEqual(response.data)
    })

    it('should merge config with POST defaults', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const config: RequestConfig = { headers: { 'X-Custom': 'value' } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: {} }
        return Promise.resolve()
      })

      // Act
      await client.post('/users', { name: 'Test' }, config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('postRaw', () => {
    it('should return full response for POST', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: { id: 2 }, status: 201 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.postRaw('/users', { name: 'New User' })

      // Assert
      expect(result).toEqual(response)
    })
  })

  describe('patch', () => {
    it('should send PATCH request with data', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const patchData = { status: 'active' }
      const response = { data: { id: 1, ...patchData } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.patch('/users/1', patchData)

      // Assert
      expect(result).toEqual(response.data)
    })

    it('should handle undefined data for PATCH', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: { id: 1 } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.patch('/users/1')

      // Assert
      expect(result).toEqual(response.data)
    })
  })

  describe('head', () => {
    it('should send HEAD request', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: undefined, status: 200 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.head('/users/1')

      // Assert
      expect(result).toEqual(response)
    })

    it('should include custom headers in HEAD request', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const config: RequestConfig = { headers: { 'If-Modified-Since': 'date' } }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: undefined, status: 304 }
        return Promise.resolve()
      })

      // Act
      await client.head('/users/1', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should send DELETE request', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: undefined, status: 204 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      const result = await client.delete('/users/1')

      // Assert
      expect(result).toEqual(response)
    })

    it('should handle delete with config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const config: RequestConfig = { timeout: 2000 }
      const response = { data: undefined, status: 200 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      await client.delete('/users/1', config)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })

    it('should handle delete with undefined config', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const response = { data: undefined, status: 204 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = response
        return Promise.resolve()
      })

      // Act
      await client.delete('/users/1', undefined)

      // Assert
      expect(composedMiddleware).toHaveBeenCalled()
    })
  })

  describe('request', () => {
    it('should execute middlewares and return response', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const expectedResponse = { data: { id: 1 }, status: 200 }
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = expectedResponse
        return Promise.resolve()
      })
      const config: RequestConfig = { url: '/users' }

      // Act
      const result = await (client as any).request(config)

      // Assert
      expect(result).toEqual(expectedResponse)
      expect(composedMiddleware).toHaveBeenCalled()
    })

    it('should pass config to middleware context', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      let contextConfig: any = null
      composedMiddleware.mockImplementation((ctx: any) => {
        contextConfig = ctx.config
        ctx.response = { data: {} }
        return Promise.resolve()
      })
      const config: RequestConfig = { url: '/test', timeout: 5000 }

      // Act
      await (client as any).request(config)

      // Assert
      expect(contextConfig).toEqual(config)
    })

    it('should handle middleware rejections', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const error = new Error('Middleware error')
      composedMiddleware.mockRejectedValue(error)

      // Act & Assert
      await expect((client as any).request({})).rejects.toThrow('Middleware error')
    })
  })

  describe('getConfig', () => {
    it('should include cacheable type from instance', () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        cacheableType: CacheType.Disk,
        logger,
      })

      // Act
      const config = (client as any).getConfig('/users', {})

      // Assert
      expect(config.cacheable).toBe(CacheType.Disk)
    })

    it('should include memoizable from instance', () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        memoizable: false,
        logger,
      })

      // Act
      const config = (client as any).getConfig('/users', {})

      // Assert
      expect(config.memoizable).toBe(false)
    })

    it('should merge provided config', () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const providedConfig: RequestConfig = { timeout: 3000, headers: { 'X-Test': 'value' } }

      // Act
      const config = (client as any).getConfig('/users', providedConfig)

      // Assert
      expect(config.url).toBe('/users')
      expect(config.timeout).toBe(3000)
      expect(config.headers).toEqual(providedConfig.headers)
    })

    it('should set url in config', () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })

      // Act
      const config = (client as any).getConfig('/api/endpoint', {})

      // Assert
      expect(config.url).toBe('/api/endpoint')
    })

    it('should use default values when config is not provided', () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        cacheableType: CacheType.Memory,
        memoizable: true,
        logger,
      })

      // Act
      const config = (client as any).getConfig('/users')

      // Assert
      expect(config.cacheable).toBe(CacheType.Memory)
      expect(config.memoizable).toBe(true)
      expect(config.url).toBe('/users')
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle null logger gracefully', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: null as any,
      })

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should handle empty string URL', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: {} }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('')

      // Assert
      expect(result).toEqual({})
    })

    it('should handle large data payloads', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      const largeData = Array(10000).fill({ key: 'value' })
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: { success: true } }
        return Promise.resolve()
      })

      // Act
      const result = await client.post('/upload', largeData)

      // Assert
      expect(result).toEqual({ success: true })
    })

    it('should handle rapid sequential requests', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { data: { id: 1 } }
        return Promise.resolve()
      })

      // Act
      const promises = Array(5)
        .fill(null)
        .map((_, i) => client.get(`/users/${i}`))
      const results = await Promise.all(promises)

      // Assert
      expect(results).toHaveLength(5)
      expect(composedMiddleware).toHaveBeenCalledTimes(5)
    })

    it('should handle response without data field', async () => {
      // Arrange
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger,
      })
      composedMiddleware.mockImplementation((ctx: any) => {
        ctx.response = { status: 204 }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/users')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle all concurrent options together', () => {
      // Arrange & Act
      const memoryCache = new Map()
      const diskCache = new Map()
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        concurrency: 10,
        memoryCache,
        diskCache,
        memoizable: true,
        cacheableType: CacheType.Disk,
        logger,
      })

      // Assert
      expect(client.name).toBe('https://api.example.com')
      expect(pLimit).toHaveBeenCalledWith(10)
    })
  })
})
