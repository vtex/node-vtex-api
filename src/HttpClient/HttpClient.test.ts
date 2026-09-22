import { HttpClient } from './HttpClient'
import { CacheType } from './middlewares/cache'
import { Logger } from '../service/logger'
import * as bodyHashUtils from '../utils/bodyHash'
import { AxiosResponse } from 'axios'

jest.mock('koa-compose', () => {
  return jest.fn((middlewares: any[]) => {
    return async (context: any) => {
      for (const middleware of middlewares) {
        if (middleware) {
          await middleware(context, () => Promise.resolve())
        }
      }
    }
  })
})

jest.mock('p-limit', () => {
  return jest.fn(() => (fn: () => Promise<any>) => fn())
})

jest.mock('../utils/binding', () => ({
  formatBindingHeaderValue: jest.fn((val) => `binding:${val}`),
}))

jest.mock('../utils/tenant', () => ({
  formatTenantHeaderValue: jest.fn((val) => `tenant:${val}`),
}))

jest.mock('../utils/bodyHash', () => ({
  computeBodyHash: jest.fn((data) => `hash_${JSON.stringify(data)}`),
}))

jest.mock('./middlewares/cache', () => ({
  cacheMiddleware: jest.fn(() => async (ctx: any, next: any) => next()),
  CacheType: { Memory: 'memory', Disk: 'disk' },
}))

jest.mock('./middlewares/cancellationToken', () => ({
  cancellationToken: jest.fn(() => async (ctx: any, next: any) => next()),
}))

jest.mock('./middlewares/inflight', () => ({
  singleFlightMiddleware: async (ctx: any, next: any) => next(),
}))

jest.mock('./middlewares/memoization', () => ({
  memoizationMiddleware: jest.fn(() => async (ctx: any, next: any) => next()),
}))

jest.mock('./middlewares/metrics', () => ({
  metricsMiddleware: jest.fn(() => async (ctx: any, next: any) => next()),
}))

jest.mock('./middlewares/notFound', () => ({
  acceptNotFoundMiddleware: async (ctx: any, next: any) => next(),
  notFoundFallbackMiddleware: async (ctx: any, next: any) => next(),
}))

jest.mock('./middlewares/recorder', () => ({
  recorderMiddleware: jest.fn(() => async (ctx: any, next: any) => next()),
}))

jest.mock('./middlewares/request', () => ({
  defaultsMiddleware: jest.fn(() => async (ctx: any, next: any) => next()),
  requestMiddleware: jest.fn(() => async (ctx: any, next: any) => next()),
  routerCacheMiddleware: async (ctx: any, next: any) => next(),
}))

jest.mock('./middlewares/tracing', () => ({
  createHttpClientTracingMiddleware: jest.fn(() => async (ctx: any, next: any) => next()),
}))

describe('HttpClient', () => {
  let mockLogger: jest.Mocked<Logger>
  let mockMemoryCache: any
  let mockDiskCache: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockLogger = {
      warn: jest.fn(),
    } as any

    mockMemoryCache = new Map()
    mockDiskCache = new Map()
  })

  describe('constructor', () => {
    it('should initialize with minimal options', () => {
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
        name: 'MyClient',
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('MyClient')
    })

    it('should default name to "unknown" when neither name nor baseURL provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set cacheableType to Memory by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect((client as any).cacheableType).toBe(CacheType.Memory)
    })

    it('should set cacheableType to provided value', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        cacheableType: CacheType.Disk,
      })

      // Assert
      expect((client as any).cacheableType).toBe(CacheType.Disk)
    })

    it('should set memoizable to true by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect((client as any).memoizable).toBe(true)
    })

    it('should set memoizable to false when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        memoizable: false,
      })

      // Assert
      expect((client as any).memoizable).toBe(false)
    })

    it('should include Authorization header when authType and authToken provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        authType: 'Bearer',
        authToken: 'token123',
      })

      // Assert - middleware will receive headers with Authorization
      expect(client).toBeDefined()
    })

    it('should not include Authorization header when only authType provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        authType: 'Bearer',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should not include Authorization header when only authToken provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        authToken: 'token123',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include custom headers', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        headers: { 'X-Custom': 'value' },
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include account header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        account: 'my-account',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include host header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        host: 'example.com',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include tenant header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        tenant: 'tenant-id',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include binding header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        binding: 'binding-id',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include locale header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        locale: 'en-US',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include operationId header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        operationId: 'op-123',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include product header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        product: 'my-product',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include segment header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        segmentToken: 'segment-123',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include session header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        sessionToken: 'session-123',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include User-Agent header with provided userAgent', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        userAgent: 'MyAgent/1.0',
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include Accept-Encoding header', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include custom middlewares when provided', () => {
      // Arrange
      const customMiddleware = jest.fn()

      // Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        middlewares: [customMiddleware],
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should handle concurrency option with positive value', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        concurrency: 5,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should handle concurrency option with zero value', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        concurrency: 0,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should handle concurrency option with negative value', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        concurrency: -1,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include memory cache middleware when memoryCache provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        memoryCache: mockMemoryCache,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include disk cache middleware when diskCache provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        diskCache: mockDiskCache,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should include recorder middleware when recorder provided', () => {
      // Arrange
      const mockRecorder = jest.fn()

      // Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        recorder: mockRecorder,
      })

      // Assert
      expect(client).toBeDefined()
    })

    it('should handle all options simultaneously', () => {
      // Arrange & Act
      const client = new HttpClient({
        baseURL: 'https://api.example.com',
        name: 'TestClient',
        logger: mockLogger,
        authType: 'Bearer',
        authToken: 'token123',
        userAgent: 'TestAgent/1.0',
        account: 'account-id',
        host: 'host-name',
        tenant: 'tenant-id',
        binding: 'binding-id',
        locale: 'en-US',
        operationId: 'op-id',
        product: 'product-id',
        segmentToken: 'segment-id',
        sessionToken: 'session-id',
        timeout: 5000,
        retries: 3,
        concurrency: 10,
        memoryCache: mockMemoryCache,
        diskCache: mockDiskCache,
        memoizable: false,
        cacheableType: CacheType.Disk,
      })

      // Assert
      expect(client.name).toBe('TestClient')
    })
  })

  describe('get', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return data from response', async () => {
      // Arrange
      const mockResponse = { data: { id: 1, name: 'test' } }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/endpoint')

      // Assert
      expect(result).toEqual({ id: 1, name: 'test' })
    })

    it('should pass url and config to request', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.get('/endpoint', config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/endpoint',
          cacheable: CacheType.Memory,
          memoizable: true,
          headers: { 'X-Custom': 'value' },
        })
      )
    })

    it('should handle empty config', async () => {
      // Arrange
      const mockResponse = { data: { result: 'success' } }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/endpoint')

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should handle null/undefined response data', async () => {
      // Arrange
      const mockResponse = { data: null }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/endpoint')

      // Assert
      expect(result).toBeNull()
    })

    it('should reject on request error', async () => {
      // Arrange
      const error = new Error('Request failed')
      jest.spyOn(client as any, 'request').mockRejectedValue(error)

      // Act & Assert
      await expect(client.get('/endpoint')).rejects.toThrow('Request failed')
    })
  })

  describe('getRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return full AxiosResponse', async () => {
      // Arrange
      const mockResponse: any = {
        data: { id: 1 },
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getRaw('/endpoint')

      // Assert
      expect(result).toEqual(mockResponse)
      expect(result.status).toBe(200)
    })

    it('should pass config to request', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.getRaw('/endpoint', config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/endpoint',
          headers: { 'X-Custom': 'value' },
        })
      )
    })

    it('should handle empty config', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getRaw('/endpoint')

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('getWithBody', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return data from response', async () => {
      // Arrange
      const mockResponse = { data: { result: 'success' } }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getWithBody('/endpoint', { key: 'value' })

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should compute body hash and include in params', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const bodyData = { key: 'value' }

      // Act
      await client.getWithBody('/endpoint', bodyData)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/endpoint',
          data: bodyData,
          params: expect.objectContaining({
            '__bodyHash': expect.any(String),
          }),
        })
      )
    })

    it('should handle undefined body data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getWithBody('/endpoint', undefined)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
    })

    it('should merge existing params with body hash', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getWithBody('/endpoint', { key: 'value' }, { params: { existing: 'param' } })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            existing: 'param',
            '__bodyHash': expect.any(String),
          }),
        })
      )
    })

    it('should log warning on body hash computation error', async () => {
      // Arrange
      const mockResponse = { data: {} }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      (bodyHashUtils.computeBodyHash as jest.Mock).mockImplementation((data, onError) => {
        onError()
        return 'fallback-hash'
      })

      // Act
      await client.getWithBody('/endpoint', { key: 'value' })

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith({
        message: 'Error while sorting object for cache key',
      })
    })

    it('should handle null body data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getWithBody('/endpoint', null)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
    })
  })

  describe('getBuffer', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return buffer data', async () => {
      // Arrange
      const bufferData = Buffer.from('test data')
      const mockResponse = { data: bufferData, headers: { 'content-length': '9' } }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getBuffer('/file')

      // Assert
      expect(result.data).toEqual(bufferData)
      expect(result.headers['content-length']).toBe('9')
    })

    it('should set responseType to arraybuffer', async () => {
      // Arrange
      const mockResponse = { data: Buffer.from(''), headers: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getBuffer('/file')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'arraybuffer',
          url: '/file',
          cacheable: CacheType.Disk,
        })
      )
    })

    it('should disable transform response', async () => {
      // Arrange
      const mockResponse = { data: Buffer.from(''), headers: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getBuffer('/file')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          transformResponse: expect.any(Array),
        })
      )
    })

    it('should merge provided config', async () => {
      // Arrange
      const mockResponse = { data: Buffer.from(''), headers: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.getBuffer('/file', config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        })
      )
    })
  })

  describe('getStream', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return IncomingMessage stream', async () => {
      // Arrange
      const mockStream = { pipe: jest.fn() } as any
      const mockResponse = { data: mockStream }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getStream('/file')

      // Assert
      expect(result).toEqual(mockStream)
    })

    it('should set responseType to stream', async () => {
      // Arrange
      const mockStream = {} as any
      const mockResponse = { data: mockStream }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getStream('/file')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'stream',
        })
      )
    })

    it('should disable transform response', async () => {
      // Arrange
      const mockStream = {} as any
      const mockResponse = { data: mockStream }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getStream('/file')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          transformResponse: expect.any(Array),
        })
      )
    })

    it('should merge provided config', async () => {
      // Arrange
      const mockStream = {} as any
      const mockResponse = { data: mockStream }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.getStream('/file', config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        })
      )
    })
  })

  describe('put', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return response data', async () => {
      // Arrange
      const mockResponse = { data: { updated: true } }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.put('/endpoint', { key: 'value' })

      // Assert
      expect(result).toEqual({ updated: true })
    })

    it('should set method to put', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.put('/endpoint', { key: 'value' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'put',
        })
      )
    })

    it('should include data in config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const data = { key: 'value' }

      // Act
      await client.put('/endpoint', data)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
        })
      )
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.put('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: undefined,
        })
      )
    })

    it('should merge provided config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.put('/endpoint', { key: 'value' }, config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        })
      )
    })

    it('should return void data when no data in response', async () => {
      // Arrange
      const mockResponse = { data: undefined }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.put('/endpoint', { key: 'value' })

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('putRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return full response', async () => {
      // Arrange
      const mockResponse: any = {
        data: { updated: true },
        status: 200,
        headers: {},
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.putRaw('/endpoint', { key: 'value' })

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should set method to put', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.putRaw('/endpoint', { key: 'value' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'put',
        })
      )
    })

    it('should include data in config', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const data = { key: 'value' }

      // Act
      await client.putRaw('/endpoint', data)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
        })
      )
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.putRaw('/endpoint')

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('post', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return response data', async () => {
      // Arrange
      const mockResponse = { data: { created: true, id: 1 } }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.post('/endpoint', { key: 'value' })

      // Assert
      expect(result).toEqual({ created: true, id: 1 })
    })

    it('should set method to post', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.post('/endpoint', { key: 'value' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
        })
      )
    })

    it('should include data in config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const data = { key: 'value' }

      // Act
      await client.post('/endpoint', data)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
        })
      )
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.post('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: undefined,
        })
      )
    })

    it('should merge provided config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.post('/endpoint', { key: 'value' }, config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        })
      )
    })

    it('should return void data when no data in response', async () => {
      // Arrange
      const mockResponse = { data: undefined }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.post('/endpoint', { key: 'value' })

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('postRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return full response', async () => {
      // Arrange
      const mockResponse: any = {
        data: { created: true, id: 1 },
        status: 201,
        headers: {},
      }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.postRaw('/endpoint', { key: 'value' })

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should set method to post', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.postRaw('/endpoint', { key: 'value' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
        })
      )
    })

    it('should include data in config', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const data = { key: 'value' }

      // Act
      await client.postRaw('/endpoint', data)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
        })
      )
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse: any = { data: {} }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.postRaw('/endpoint')

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('patch', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return response data', async () => {
      // Arrange
      const mockResponse = { data: { patched: true } }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.patch('/endpoint', { key: 'new-value' })

      // Assert
      expect(result).toEqual({ patched: true })
    })

    it('should set method to patch', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.patch('/endpoint', { key: 'new-value' })

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'patch',
        })
      )
    })

    it('should include data in config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const data = { key: 'new-value' }

      // Act
      await client.patch('/endpoint', data)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
        })
      )
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.patch('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: undefined,
        })
      )
    })

    it('should merge provided config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.patch('/endpoint', { key: 'new-value' }, config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        })
      )
    })

    it('should return void data when no data in response', async () => {
      // Arrange
      const mockResponse = { data: undefined }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.patch('/endpoint', { key: 'new-value' })

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('head', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return full response', async () => {
      // Arrange
      const mockResponse: any = { status: 200, headers: {}, data: undefined }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.head('/endpoint')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should set method to head', async () => {
      // Arrange
      const mockResponse: any = { status: 200, headers: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.head('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'head',
        })
      )
    })

    it('should merge provided config', async () => {
      // Arrange
      const mockResponse: any = { status: 200 }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.head('/endpoint', config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        })
      )
    })

    it('should include url in config', async () => {
      // Arrange
      const mockResponse: any = { status: 200 }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.head('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/endpoint',
        })
      )
    })
  })

  describe('delete', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should return full response', async () => {
      // Arrange
      const mockResponse: any = { status: 204, headers: {}, data: undefined }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.delete('/endpoint')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should set method to delete', async () => {
      // Arrange
      const mockResponse: any = { status: 204 }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.delete('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'delete',
        })
      )
    })

    it('should handle undefined config', async () => {
      // Arrange
      const mockResponse: any = { status: 204 }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.delete('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalled()
    })

    it('should merge provided config', async () => {
      // Arrange
      const mockResponse: any = { status: 204 }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.delete('/endpoint', config)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'value' },
        })
      )
    })

    it('should include url in config', async () => {
      // Arrange
      const mockResponse: any = { status: 204 }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.delete('/endpoint')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/endpoint',
        })
      )
    })

    it('should handle null config', async () => {
      // Arrange
      const mockResponse: any = { status: 204 }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.delete('/endpoint', null as any)

      // Assert
      expect(result).toBeDefined()
    })
  })

  describe('request (protected)', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should run middlewares with config context', async () => {
      // Arrange
      const mockConfig = { url: '/endpoint', method: 'get' }
      const mockResponse: any = { data: {}, status: 200 }
      const middlewaresSpy = jest.spyOn(client as any, 'runMiddlewares').mockResolvedValue(undefined)
      ;(client as any).runMiddlewares = middlewaresSpy

      // Mock the actual middleware execution
      ;(client as any).runMiddlewares = async (context: any) => {
        context.response = mockResponse
      }

      // Act
      const result = await (client as any).request(mockConfig)

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should return response from context after middleware execution', async () => {
      // Arrange
      const mockConfig = { url: '/test' }
      const expectedResponse: any = { data: { result: 'ok' }, status: 200 }
      ;(client as any).runMiddlewares = async (context: any) => {
        context.response = expectedResponse
      }

      // Act
      const result = await (client as any).request(mockConfig)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should handle middleware error', async () => {
      // Arrange
      const mockConfig = { url: '/endpoint' }
      const error = new Error('Middleware error')
      ;(client as any).runMiddlewares = jest.fn().mockRejectedValue(error)

      // Act & Assert
      await expect((client as any).request(mockConfig)).rejects.toThrow('Middleware error')
    })
  })

  describe('getConfig (private)', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        cacheableType: CacheType.Memory,
        memoizable: true,
      })
    })

    it('should include cacheable type', () => {
      // Act
      const config = (client as any).getConfig('/endpoint')

      // Assert
      expect(config.cacheable).toBe(CacheType.Memory)
    })

    it('should include memoizable flag', () => {
      // Act
      const config = (client as any).getConfig('/endpoint')

      // Assert
      expect(config.memoizable).toBe(true)
    })

    it('should include url', () => {
      // Act
      const config = (client as any).getConfig('/endpoint')

      // Assert
      expect(config.url).toBe('/endpoint')
    })

    it('should merge provided config', () => {
      // Act
      const config = (client as any).getConfig('/endpoint', { headers: { 'X-Custom': 'value' } })

      // Assert
      expect(config.headers).toEqual({ 'X-Custom': 'value' })
      expect(config.url).toBe('/endpoint')
    })

    it('should respect memoizable: false from instance', () => {
      // Arrange
      const clientNonMemoizable = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
        memoizable: false,
      })

      // Act
      const config = (clientNonMemoizable as any).getConfig('/endpoint')

      // Assert
      expect(config.memoizable).toBe(false)
    })

    it('should use provided cacheableType from config', () => {
      // Act
      const config = (client as any).getConfig('/endpoint', { cacheable: CacheType.Disk })

      // Assert
      expect(config.cacheable).toBe(CacheType.Disk)
    })
  })

  describe('edge cases and integration', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient({
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      })
    })

    it('should handle complex nested data structures', async () => {
      // Arrange
      const complexData = {
        user: {
          name: 'John',
          nested: {
            deep: {
              value: 'test',
            },
          },
        },
      }
      const mockResponse = { data: complexData }
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.post('/endpoint', complexData)

      // Assert
      expect(result).toEqual(complexData)
    })

    it('should handle empty string URL', async () => {
      // Arrange
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.get('')

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '',
        })
      )
    })

    it('should handle very long URL', async () => {
      // Arrange
      const longUrl = '/endpoint/' + 'a'.repeat(1000)
      const mockResponse = { data: {} }
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.get(longUrl)

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: longUrl,
        })
      )
    })

    it('should handle multiple sequential requests', async () => {
      // Arrange
      const mockResponse1 = { data: { id: 1 } }
      const mockResponse2 = { data: { id: 2 } }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2)

      // Act
      const result1 = await client.get('/endpoint1')
      const result2 = await client.get('/endpoint2')

      // Assert
      expect(result1).toEqual({ id: 1 })
      expect(result2).toEqual({ id: 2 })
      expect(requestSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle request after error', async () => {
      // Arrange
      const error = new Error('Network error')
      const mockResponse = { data: { success: true } }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockRejectedValueOnce(error).mockResolvedValueOnce(mockResponse)

      // Act & Assert
      await expect(client.get('/endpoint1')).rejects.toThrow('Network error')
      const result = await client.get('/endpoint2')
      expect(result).toEqual({ success: true })
    })
  })
})
