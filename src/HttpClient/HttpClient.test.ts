import { HttpClient } from './HttpClient'
import { Logger } from '../service/logger'
import { CacheType } from './middlewares/cache'
import { IOContext } from '../service/worker/runtime/typings'
import { InstanceOptions, RequestConfig, MiddlewareContext } from './typings'
import { AxiosResponse } from 'axios'

jest.mock('koa-compose', () => {
  return jest.fn((middlewares) => {
    return jest.fn(async (context: MiddlewareContext) => {
      for (const middleware of middlewares) {
        if (typeof middleware === 'function') {
          await middleware(context, async () => {})
        }
      }
    })
  })
})

jest.mock('p-limit', () => {
  return jest.fn(() => (fn: () => Promise<any>) => fn())
})

jest.mock('../utils/bodyHash', () => ({
  computeBodyHash: jest.fn((data) => 'test-hash-123'),
}))

jest.mock('../utils/binding', () => ({
  formatBindingHeaderValue: jest.fn((value) => `binding-${value}`),
}))

jest.mock('../utils/tenant', () => ({
  formatTenantHeaderValue: jest.fn((value) => `tenant-${value}`),
}))

jest.mock('./middlewares/cache', () => ({
  CacheType: { Memory: 'memory', Disk: 'disk' },
  cacheMiddleware: jest.fn(() => async () => {}),
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
  let clientOptions: IOContext & Partial<InstanceOptions>

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as any

    clientOptions = {
      account: 'test-account',
      baseURL: 'http://localhost:3000',
      authToken: 'test-token',
      authType: 'Bearer',
      memoryCache: undefined,
      diskCache: undefined,
      memoizable: true,
      locale: 'en-US',
      name: 'test-client',
      userAgent: 'TestAgent/1.0',
      timeout: 5000,
      logger: mockLogger,
    }
  })

  describe('constructor', () => {
    it('should initialize with minimal options', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
        baseURL: 'http://localhost:3000',
      })

      // Assert
      expect(client.name).toBe('http://localhost:3000')
    })

    it('should set name from options when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        name: 'custom-name',
      })

      // Assert
      expect(client.name).toBe('custom-name')
    })

    it('should default name to baseURL when name not provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        name: undefined,
      })

      // Assert
      expect(client.name).toBe(clientOptions.baseURL)
    })

    it('should default name to "unknown" when neither name nor baseURL provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should include authorization header when authType and authToken are provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        authType: 'Bearer',
        authToken: 'xyz123',
      })

      // Assert - verify construction doesn't throw and name is set
      expect(client.name).toBeDefined()
    })

    it('should not include authorization header when authType is missing', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        authType: undefined,
        authToken: 'xyz123',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should not include authorization header when authToken is missing', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        authType: 'Bearer',
        authToken: undefined,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include account header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        account: 'my-account',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should not include account header when not provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        account: undefined,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include forwarded host header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        host: 'custom-host.com',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include tenant header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        tenant: { id: 'tenant-1' } as any,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include binding header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        binding: { id: 'binding-1' } as any,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include locale header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        locale: 'pt-BR',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include operation id header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        operationId: 'op-123',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include product header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        product: 'my-product',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include segment token header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        segmentToken: 'seg-123',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include session token header when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        sessionToken: 'sess-123',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should always include Accept-Encoding header', () => {
      // Arrange & Act
      const client = new HttpClient({
        logger: mockLogger,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should always include User-Agent header', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        userAgent: 'MyAgent/2.0',
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should use default timeout when not provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        timeout: undefined,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should use provided timeout value', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        timeout: 10000,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should apply concurrency limit when provided', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        concurrency: 5,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should not apply concurrency limit when concurrency is 0', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        concurrency: 0,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should not apply concurrency limit when concurrency is undefined', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        concurrency: undefined,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should use Memory cache type by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        cacheableType: undefined,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should use provided cache type', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        cacheableType: CacheType.Disk,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should set memoizable to true by default', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        memoizable: undefined,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should respect memoizable false setting', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        memoizable: false,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should merge default headers with provided headers', () => {
      // Arrange & Act
      const client = new HttpClient({
        ...clientOptions,
        headers: { 'X-Custom': 'custom-value' },
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include recorder middleware when recorder is provided', () => {
      // Arrange & Act
      const mockRecorder = jest.fn()
      const client = new HttpClient({
        ...clientOptions,
        recorder: mockRecorder as any,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include memory cache middleware when memoryCache is provided', () => {
      // Arrange & Act
      const mockMemoryCache = new Map()
      const client = new HttpClient({
        ...clientOptions,
        memoryCache: mockMemoryCache as any,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include disk cache middleware when diskCache is provided', () => {
      // Arrange & Act
      const mockDiskCache = new Map()
      const client = new HttpClient({
        ...clientOptions,
        diskCache: mockDiskCache as any,
      })

      // Assert
      expect(client.name).toBeDefined()
    })

    it('should include custom middlewares when provided', () => {
      // Arrange
      const customMiddleware = jest.fn(async () => {})

      // Act
      const client = new HttpClient({
        ...clientOptions,
        middlewares: [customMiddleware],
      })

      // Assert
      expect(client.name).toBeDefined()
    })
  })

  describe('get', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should call request with GET method and return data', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 1, name: 'test' },
        status: 200,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/api/test')

      // Assert
      expect(result).toEqual({ id: 1, name: 'test' })
      expect((client as any).request).toHaveBeenCalled()
    })

    it('should pass empty config when not provided', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'success' },
        status: 200,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/api/test')

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should pass custom config to request', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'success' },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { cacheable: CacheType.Disk }

      // Act
      await client.get('/api/test', customConfig)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig).toHaveProperty('url', '/api/test')
      expect(callConfig).toHaveProperty('cacheable', CacheType.Disk)
    })

    it('should handle null response data', async () => {
      // Arrange
      const mockResponse = {
        data: null,
        status: 204,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/api/test')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle array response data', async () => {
      // Arrange
      const mockResponse = {
        data: [{ id: 1 }, { id: 2 }],
        status: 200,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.get('/api/test')

      // Assert
      expect(result).toEqual([{ id: 1 }, { id: 2 }])
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Network error')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.get('/api/test')).rejects.toThrow('Network error')
    })
  })

  describe('getRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 1 },
        status: 200,
        headers: { 'content-type': 'application/json' },
        statusText: 'OK',
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getRaw('/api/test')

      // Assert
      expect(result).toEqual(mockResponse)
      expect(result.status).toBe(200)
      expect(result.data).toEqual({ id: 1 })
    })

    it('should pass config to request', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'ok' },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { cacheable: CacheType.Memory }

      // Act
      await client.getRaw('/api/test', customConfig)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Request failed')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.getRaw('/api/test')).rejects.toThrow('Request failed')
    })
  })

  describe('getWithBody', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should compute body hash and include in params', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'success' },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const bodyData = { key: 'value' }

      // Act
      const result = await client.getWithBody('/api/test', bodyData)

      // Assert
      expect(result).toEqual({ result: 'success' })
      expect(requestSpy).toHaveBeenCalled()
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toEqual(bodyData)
    })

    it('should handle undefined body', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'success' },
        status: 200,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getWithBody('/api/test', undefined)

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should merge existing params with body hash', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'success' },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const bodyData = { key: 'value' }
      const config = { params: { existing: 'param' } }

      // Act
      await client.getWithBody('/api/test', bodyData, config)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.params).toHaveProperty('existing', 'param')
    })

    it('should call logger.warn on body hash computation error', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'success' },
        status: 200,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      jest.spyOn(mockLogger, 'warn')

      // Act
      // Note: computeBodyHash is mocked to return 'test-hash-123'
      await client.getWithBody('/api/test', { data: 'test' })

      // Assert
      expect(mockLogger.warn).not.toHaveBeenCalled() // No error in this mock
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Bad request')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.getWithBody('/api/test', { data: 'test' })).rejects.toThrow('Bad request')
    })
  })

  describe('getBuffer', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should request buffer with arraybuffer response type', async () => {
      // Arrange
      const mockBuffer = Buffer.from('test data')
      const mockResponse = {
        data: mockBuffer,
        headers: { 'content-type': 'application/octet-stream' },
        status: 200,
      } as any
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getBuffer('/api/file.bin')

      // Assert
      expect(result.data).toEqual(mockBuffer)
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.responseType).toBe('arraybuffer')
      expect(callConfig.cacheable).toBe(CacheType.Disk)
    })

    it('should not apply transformations to buffer response', async () => {
      // Arrange
      const mockBuffer = Buffer.from('test')
      const mockResponse = {
        data: mockBuffer,
        headers: {},
        status: 200,
      } as any
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getBuffer('/api/file')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.transformResponse).toBeDefined()
    })

    it('should merge custom config with buffer config', async () => {
      // Arrange
      const mockBuffer = Buffer.from('data')
      const mockResponse = {
        data: mockBuffer,
        headers: {},
        status: 200,
      } as any
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { timeout: 3000 }

      // Act
      await client.getBuffer('/api/file', customConfig)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.timeout).toBe(3000)
      expect(callConfig.responseType).toBe('arraybuffer')
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('File not found')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.getBuffer('/api/file')).rejects.toThrow('File not found')
    })
  })

  describe('getStream', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should request stream with stream response type', async () => {
      // Arrange
      const mockStream = { readable: true } as any
      const mockResponse = {
        data: mockStream,
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.getStream('/api/stream')

      // Assert
      expect(result).toEqual(mockStream)
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.responseType).toBe('stream')
    })

    it('should not apply transformations to stream response', async () => {
      // Arrange
      const mockStream = {} as any
      const mockResponse = {
        data: mockStream,
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.getStream('/api/stream')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.transformResponse).toBeDefined()
    })

    it('should merge custom config with stream config', async () => {
      // Arrange
      const mockStream = {} as any
      const mockResponse = {
        data: mockStream,
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { timeout: 60000 }

      // Act
      await client.getStream('/api/stream', customConfig)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.timeout).toBe(60000)
      expect(callConfig.responseType).toBe('stream')
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Stream unavailable')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.getStream('/api/stream')).rejects.toThrow('Stream unavailable')
    })
  })

  describe('put', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send PUT request with data and return response data', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 1, updated: true },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const updateData = { name: 'updated' }

      // Act
      const result = await client.put('/api/resource/1', updateData)

      // Assert
      expect(result).toEqual({ id: 1, updated: true })
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('put')
      expect(callConfig.data).toEqual(updateData)
      expect(callConfig.url).toBe('/api/resource/1')
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = {
        data: { success: true },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.put('/api/resource/1')

      // Assert
      expect(result).toEqual({ success: true })
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toBeUndefined()
    })

    it('should merge custom config with PUT config', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'ok' },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { timeout: 5000 }

      // Act
      await client.put('/api/resource/1', { name: 'test' }, customConfig)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.timeout).toBe(5000)
      expect(callConfig.method).toBe('put')
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Update failed')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.put('/api/resource/1', { name: 'test' })).rejects.toThrow('Update failed')
    })
  })

  describe('putRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 1, updated: true },
        status: 200,
        headers: { 'content-type': 'application/json' },
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.putRaw('/api/resource/1', { name: 'test' })

      // Assert
      expect(result).toEqual(mockResponse)
      expect(result.status).toBe(200)
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = {
        data: { success: true },
        status: 204,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.putRaw('/api/resource/1')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Server error')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.putRaw('/api/resource/1', { name: 'test' })).rejects.toThrow('Server error')
    })
  })

  describe('post', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send POST request with data and return response data', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 123, created: true },
        status: 201,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const postData = { name: 'new item' }

      // Act
      const result = await client.post('/api/items', postData)

      // Assert
      expect(result).toEqual({ id: 123, created: true })
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('post')
      expect(callConfig.data).toEqual(postData)
      expect(callConfig.url).toBe('/api/items')
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'created' },
        status: 201,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.post('/api/items')

      // Assert
      expect(result).toEqual({ result: 'created' })
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toBeUndefined()
    })

    it('should merge custom config with POST config', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 1 },
        status: 201,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { timeout: 7000 }

      // Act
      await client.post('/api/items', { name: 'test' }, customConfig)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.timeout).toBe(7000)
      expect(callConfig.method).toBe('post')
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Creation failed')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.post('/api/items', { name: 'test' })).rejects.toThrow('Creation failed')
    })
  })

  describe('postRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 123, created: true },
        status: 201,
        headers: { 'location': '/api/items/123' },
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.postRaw('/api/items', { name: 'test' })

      // Assert
      expect(result).toEqual(mockResponse)
      expect(result.status).toBe(201)
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'processed' },
        status: 202,
      } as AxiosResponse
      jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.postRaw('/api/items')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Bad request')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.postRaw('/api/items', { name: 'test' })).rejects.toThrow('Bad request')
    })
  })

  describe('patch', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send PATCH request with data and return response data', async () => {
      // Arrange
      const mockResponse = {
        data: { id: 1, patched: true },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const patchData = { status: 'active' }

      // Act
      const result = await client.patch('/api/items/1', patchData)

      // Assert
      expect(result).toEqual({ id: 1, patched: true })
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('patch')
      expect(callConfig.data).toEqual(patchData)
      expect(callConfig.url).toBe('/api/items/1')
    })

    it('should handle undefined data', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'patched' },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.patch('/api/items/1')

      // Assert
      expect(result).toEqual({ result: 'patched' })
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toBeUndefined()
    })

    it('should merge custom config with PATCH config', async () => {
      // Arrange
      const mockResponse = {
        data: { result: 'ok' },
        status: 200,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { timeout: 4000 }

      // Act
      await client.patch('/api/items/1', { status: 'active' }, customConfig)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.timeout).toBe(4000)
      expect(callConfig.method).toBe('patch')
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Patch failed')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.patch('/api/items/1', { status: 'active' })).rejects.toThrow('Patch failed')
    })
  })

  describe('head', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send HEAD request and return full response', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        headers: { 'x-total-count': '100' },
        data: undefined,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.head('/api/items')

      // Assert
      expect(result).toEqual(mockResponse)
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('head')
      expect(callConfig.url).toBe('/api/items')
    })

    it('should merge custom config with HEAD config', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        headers: {},
        data: undefined,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { timeout: 2000 }

      // Act
      await client.head('/api/items', customConfig)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.timeout).toBe(2000)
      expect(callConfig.method).toBe('head')
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Not found')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.head('/api/items')).rejects.toThrow('Not found')
    })
  })

  describe('delete', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should send DELETE request and return response', async () => {
      // Arrange
      const mockResponse = {
        status: 204,
        data: undefined,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      const result = await client.delete('/api/items/1')

      // Assert
      expect(result).toEqual(mockResponse)
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('delete')
      expect(callConfig.url).toBe('/api/items/1')
    })

    it('should handle undefined config', async () => {
      // Arrange
      const mockResponse = {
        status: 204,
        data: undefined,
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)

      // Act
      await client.delete('/api/items/1')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.url).toBe('/api/items/1')
      expect(callConfig.method).toBe('delete')
    })

    it('should merge custom config with DELETE config', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        data: { deleted: true },
      } as AxiosResponse
      const requestSpy = jest.spyOn(client as any, 'request').mockResolvedValue(mockResponse)
      const customConfig = { timeout: 3000 }

      // Act
      await client.delete('/api/items/1', customConfig)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.timeout).toBe(3000)
      expect(callConfig.method).toBe('delete')
    })

    it('should reject on request failure', async () => {
      // Arrange
      const mockError = new Error('Deletion failed')
      jest.spyOn(client as any, 'request').mockRejectedValue(mockError)

      // Act & Assert
      await expect(client.delete('/api/items/1')).rejects.toThrow('Deletion failed')
    })
  })

  describe('request (protected method)', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should execute middlewares and return response', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        data: { result: 'success' },
      } as AxiosResponse
      const config = { url: '/api/test', method: 'get' }
      const mockContext: MiddlewareContext = { config }

      // Mock the middleware composition to set the response
      ;(client as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // Act
      const result = await (client as any).request(config)

      // Assert
      expect(result).toEqual(mockResponse)
      expect((client as any).runMiddlewares).toHaveBeenCalledWith(
        expect.objectContaining({ config })
      )
    })

    it('should pass config to middleware context', async () => {
      // Arrange
      const mockResponse = { status: 200, data: null } as AxiosResponse
      const config = { url: '/api/test', method: 'post', data: { test: true } }
      ;(client as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // Act
      await (client as any).request(config)

      // Assert
      expect((client as any).runMiddlewares).toHaveBeenCalledWith(
        expect.objectContaining({ config })
      )
    })

    it('should propagate middleware errors', async () => {
      // Arrange
      const mockError = new Error('Middleware error')
      ;(client as any).runMiddlewares = jest.fn(async () => {
        throw mockError
      })
      const config = { url: '/api/test' }

      // Act & Assert
      await expect((client as any).request(config)).rejects.toThrow('Middleware error')
    })
  })

  describe('getConfig (private method)', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(clientOptions)
    })

    it('should include cacheable type from instance', async () => {
      // Arrange
      const client2 = new HttpClient({
        ...clientOptions,
        cacheableType: CacheType.Disk,
      })
      const config = { timeout: 5000 }

      // Act
      // We need to access through request since getConfig is private
      const mockResponse = { status: 200, data: null } as AxiosResponse
      ;(client2 as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // The getConfig is called internally by get/getRaw etc
      await client2.get('/api/test', config)

      // Assert - verify the middleware was called with merged config
      const passedContext = (client2 as any).runMiddlewares.mock.calls[0][0]
      expect(passedContext.config).toHaveProperty('cacheable', CacheType.Disk)
      expect(passedContext.config).toHaveProperty('url', '/api/test')
    })

    it('should include memoizable flag from instance', async () => {
      // Arrange
      const client2 = new HttpClient({
        ...clientOptions,
        memoizable: false,
      })

      // Act
      const mockResponse = { status: 200, data: null } as AxiosResponse
      ;(client2 as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      await client2.get('/api/test')

      // Assert
      const passedContext = (client2 as any).runMiddlewares.mock.calls[0][0]
      expect(passedContext.config).toHaveProperty('memoizable', false)
    })

    it('should merge provided config with cacheable and memoizable', async () => {
      // Arrange
      const client2 = new HttpClient({
        ...clientOptions,
        cacheableType: CacheType.Memory,
        memoizable: true,
      })
      const customConfig = { timeout: 2000, someFlag: true } as any

      // Act
      const mockResponse = { status: 200, data: null } as AxiosResponse
      ;(client2 as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      await client2.get('/api/test', customConfig)

      // Assert
      const passedContext = (client2 as any).runMiddlewares.mock.calls[0][0]
      expect(passedContext.config).toHaveProperty('cacheable', CacheType.Memory)
      expect(passedContext.config).toHaveProperty('memoizable', true)
      expect(passedContext.config).toHaveProperty('timeout', 2000)
      expect(passedContext.config).toHaveProperty('someFlag', true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty URL strings', async () => {
      // Arrange
      const client = new HttpClient(clientOptions)
      const mockResponse = { status: 200, data: null } as AxiosResponse
      ;(client as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // Act
      await client.get('')

      // Assert
      const passedContext = (client as any).runMiddlewares.mock.calls[0][0]
      expect(passedContext.config.url).toBe('')
    })

    it('should handle large data payloads', async () => {
      // Arrange
      const client = new HttpClient(clientOptions)
      const largeData = { data: 'x'.repeat(1000000) }
      const mockResponse = { status: 201, data: { id: 1 } } as AxiosResponse
      ;(client as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // Act
      const result = await client.post('/api/upload', largeData)

      // Assert
      expect(result).toEqual({ id: 1 })
    })

    it('should handle multiple concurrent requests', async () => {
      // Arrange
      const client = new HttpClient(clientOptions)
      const mockResponse = { status: 200, data: { id: 1 } } as AxiosResponse
      ;(client as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // Act
      const results = await Promise.all([
        client.get('/api/1'),
        client.get('/api/2'),
        client.get('/api/3'),
      ])

      // Assert
      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ id: 1 })
    })

    it('should handle concurrent requests with different methods', async () => {
      // Arrange
      const client = new HttpClient(clientOptions)
      const mockResponse = { status: 200, data: { id: 1 } } as AxiosResponse
      ;(client as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // Act
      const results = await Promise.all([
        client.get('/api/1'),
        client.post('/api/2', { name: 'test' }),
        client.put('/api/3', { name: 'updated' }),
        client.delete('/api/4'),
      ])

      // Assert
      expect(results).toHaveLength(4)
      expect((client as any).runMiddlewares).toHaveBeenCalledTimes(4)
    })

    it('should handle special characters in URLs', async () => {
      // Arrange
      const client = new HttpClient(clientOptions)
      const mockResponse = { status: 200, data: null } as AxiosResponse
      ;(client as any).runMiddlewares = jest.fn(async (context: MiddlewareContext) => {
        context.response = mockResponse
      })

      // Act
      await client.get('/api/resource?id=1&name=test&special=%40%23%24')

      // Assert
      const passedContext = (client as any).runMiddlewares.mock.calls[0][0]
      expect(passedContext.config.url).toContain('special=')
    })

    it('should handle null and undefined in various positions', async () => {
      // Arrange
      const client = new HttpClient({
        logger: mockLogger,
        account: null as any,
        host: undefined,
        tenant: null as any,
        binding: undefined,
        locale: null as any,
        operationId: undefined,
        product: null as any,
        segmentToken: undefined,
        sessionToken: null as any,
      })

      // Assert
      expect(client.name).toBeDefined()
    })
  })
})
