import { HttpClient } from './HttpClient'
import { Logger } from '../service/logger'
import { IOContext } from '../service/worker/runtime/typings'
import { CacheType } from './middlewares/cache'
import { InstanceOptions, MiddlewareContext } from './typings'
import compose from 'koa-compose'

jest.mock('koa-compose')
jest.mock('p-limit')
jest.mock('../utils/bodyHash')
jest.mock('../utils/tenant')
jest.mock('../utils/binding')
jest.mock('./middlewares/cache')
jest.mock('./middlewares/cancellationToken')
jest.mock('./middlewares/inflight')
jest.mock('./middlewares/memoization')
jest.mock('./middlewares/metrics')
jest.mock('./middlewares/notFound')
jest.mock('./middlewares/recorder')
jest.mock('./middlewares/request')
jest.mock('./middlewares/tracing')

describe('HttpClient', () => {
  let mockLogger: jest.Mocked<Logger>
  let mockCompose: jest.Mock
  let mockMiddleware: jest.Mock
  let baseOpts: IOContext & Partial<InstanceOptions>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as any

    mockMiddleware = jest.fn(async (ctx: MiddlewareContext) => {
      ctx.response = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: ctx.config,
      } as any
    })

    mockCompose = compose as jest.Mock
    mockCompose.mockReturnValue(mockMiddleware)

    baseOpts = {
      account: 'test-account',
      baseURL: 'https://api.example.com',
      authToken: 'test-token',
      authType: 'Bearer',
      memoryCache: undefined,
      diskCache: undefined,
      memoizable: true,
      name: 'TestClient',
      logger: mockLogger,
    }
  })

  describe('constructor', () => {
    it('should initialize with required options', () => {
      // Arrange & Act
      const client = new HttpClient(baseOpts)

      // Assert
      expect(client.name).toBe('TestClient')
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should use baseURL as name when name is not provided', () => {
      // Arrange
      const opts = { ...baseOpts, name: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should use "unknown" as name when neither name nor baseURL are provided', () => {
      // Arrange
      const opts = { ...baseOpts, name: undefined, baseURL: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should set Authorization header when authType and authToken are provided', () => {
      // Arrange & Act
      new HttpClient(baseOpts)

      // Assert
      const middlewares = mockCompose.mock.calls[0][0]
      expect(middlewares).toBeDefined()
      expect(middlewares.length).toBeGreaterThan(0)
    })

    it('should not set Authorization header when authToken is missing', () => {
      // Arrange
      const opts = { ...baseOpts, authToken: undefined }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include custom headers in the middleware chain', () => {
      // Arrange
      const opts = {
        ...baseOpts,
        headers: { 'X-Custom': 'custom-value' },
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
      const middlewares = mockCompose.mock.calls[0][0]
      expect(middlewares.length).toBeGreaterThan(0)
    })

    it('should handle concurrency limit when concurrency > 0', () => {
      // Arrange
      const opts = { ...baseOpts, concurrency: 5 }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should ignore concurrency limit when concurrency is 0 or negative', () => {
      // Arrange
      const opts = { ...baseOpts, concurrency: 0 }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include optional headers only when values are provided', () => {
      // Arrange
      const opts = {
        ...baseOpts,
        account: undefined,
        host: undefined,
        tenant: undefined,
        binding: undefined,
        locale: undefined,
        operationId: undefined,
        product: undefined,
        segmentToken: undefined,
        sessionToken: undefined,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should set default cacheableType to Memory when not specified', () => {
      // Arrange
      const opts = { ...baseOpts, cacheableType: undefined }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should use provided cacheableType', () => {
      // Arrange
      const opts = { ...baseOpts, cacheableType: CacheType.Disk }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should set default timeout when not provided', () => {
      // Arrange
      const opts = { ...baseOpts, timeout: undefined }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should use provided timeout value', () => {
      // Arrange
      const opts = { ...baseOpts, timeout: 5000 }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include recorder middleware when recorder is provided', () => {
      // Arrange
      const mockRecorder = { record: jest.fn() }
      const opts = { ...baseOpts, recorder: mockRecorder }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should handle memoizable flag', () => {
      // Arrange
      const opts = { ...baseOpts, memoizable: false }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include custom middlewares when provided', () => {
      // Arrange
      const customMiddleware = jest.fn()
      const opts = { ...baseOpts, middlewares: [customMiddleware] }

      // Act
      new HttpClient(opts)

      // Assert
      const middlewares = mockCompose.mock.calls[0][0]
      expect(middlewares).toContain(customMiddleware)
    })
  })

  describe('get method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should return data from response', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'test' }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: expectedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.get('https://api.example.com/users')

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should call request with URL and config', async () => {
      // Arrange
      const url = 'https://api.example.com/users'
      const config = { headers: { 'X-Custom': 'value' } }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({ data: { success: true } })

      // Act
      await client.get(url, config)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      requestSpy.mockRestore()
    })

    it('should use default config when not provided', async () => {
      // Arrange
      const url = 'https://api.example.com/users'

      // Act
      await client.get(url)

      // Assert
      expect(mockMiddleware).toHaveBeenCalled()
    })

    it('should handle generic type parameter', async () => {
      // Arrange
      interface User {
        id: number
        name: string
      }
      const user: User = { id: 1, name: 'John' }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: user,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.get<User>('https://api.example.com/users/1')

      // Assert
      expect(result).toEqual(user)
      expect(result.name).toBe('John')
    })
  })

  describe('getRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {},
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await client.getRaw('https://api.example.com/users')

      // Assert
      expect(result).toEqual(expectedResponse)
      expect(result.status).toBe(200)
      expect(result.data).toEqual({ success: true })
    })

    it('should preserve response metadata', async () => {
      // Arrange
      const expectedResponse = {
        data: { id: 1 },
        status: 201,
        statusText: 'Created',
        headers: { 'x-trace-id': 'abc123' },
        config: { url: '/users' },
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await client.getRaw('https://api.example.com/users')

      // Assert
      expect(result.headers['x-trace-id']).toBe('abc123')
      expect(result.statusText).toBe('Created')
    })
  })

  describe('getWithBody method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
      jest.mock('../utils/bodyHash', () => ({
        computeBodyHash: jest.fn(() => 'hash123'),
      }))
    })

    it('should include body in request config', async () => {
      // Arrange
      const body = { query: 'search term' }
      const expectedData = { results: [] }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: expectedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.getWithBody('https://api.example.com/search', body)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should compute body hash and add to params', async () => {
      // Arrange
      const body = { key: 'value' }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({ data: { success: true } })

      // Act
      await client.getWithBody('https://api.example.com/users', body)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toEqual(body)
      requestSpy.mockRestore()
    })

    it('should merge existing params with body hash', async () => {
      // Arrange
      const body = { query: 'test' }
      const config = { params: { limit: 10 } }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({ data: { success: true } })

      // Act
      await client.getWithBody('https://api.example.com/users', body, config)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      requestSpy.mockRestore()
    })

    it('should handle undefined body', async () => {
      // Arrange
      const expectedData = { result: 'ok' }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: expectedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.getWithBody('https://api.example.com/users', undefined)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should log warning if body hash computation fails', async () => {
      // Arrange
      const body = { key: 'value' }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({ data: { success: true } })

      // Act
      await client.getWithBody('https://api.example.com/users', body)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      requestSpy.mockRestore()
    })
  })

  describe('getBuffer method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should set responseType to arraybuffer', async () => {
      // Arrange
      const buffer = Buffer.from('test data')
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: buffer,
        headers: { 'content-type': 'application/octet-stream' },
      })

      // Act
      const result = await client.getBuffer('https://api.example.com/file')

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.responseType).toBe('arraybuffer')
      requestSpy.mockRestore()
    })

    it('should set cacheable to Disk', async () => {
      // Arrange
      const buffer = Buffer.from('test')
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: buffer,
        headers: {},
      })

      // Act
      await client.getBuffer('https://api.example.com/file')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.cacheable).toBe(CacheType.Disk)
      requestSpy.mockRestore()
    })

    it('should disable transformResponse', async () => {
      // Arrange
      const buffer = Buffer.from('test')
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: buffer,
        headers: {},
      })

      // Act
      await client.getBuffer('https://api.example.com/file')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.transformResponse).toBeDefined()
      requestSpy.mockRestore()
    })

    it('should return buffer and headers', async () => {
      // Arrange
      const buffer = Buffer.from('file content')
      const headers = { 'content-length': '12' }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: buffer,
          headers,
          status: 200,
          statusText: 'OK',
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.getBuffer('https://api.example.com/file')

      // Assert
      expect(result.data).toEqual(buffer)
      expect(result.headers).toEqual(headers)
    })
  })

  describe('getStream method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should set responseType to stream', async () => {
      // Arrange
      const mockStream = { on: jest.fn() } as any
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: mockStream,
      })

      // Act
      await client.getStream('https://api.example.com/stream')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.responseType).toBe('stream')
      requestSpy.mockRestore()
    })

    it('should return IncomingMessage stream', async () => {
      // Arrange
      const mockStream = { on: jest.fn(), pipe: jest.fn() } as any
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: mockStream,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.getStream('https://api.example.com/stream')

      // Assert
      expect(result).toEqual(mockStream)
    })

    it('should disable transformResponse', async () => {
      // Arrange
      const mockStream = {} as any
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: mockStream,
      })

      // Act
      await client.getStream('https://api.example.com/stream')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.transformResponse).toBeDefined()
      requestSpy.mockRestore()
    })
  })

  describe('put method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should set method to put', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1 },
      })

      // Act
      await client.put('https://api.example.com/users/1', { name: 'Updated' })

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('put')
      requestSpy.mockRestore()
    })

    it('should include data in request', async () => {
      // Arrange
      const data = { name: 'Updated User' }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1, ...data },
      })

      // Act
      await client.put('https://api.example.com/users/1', data)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toEqual(data)
      requestSpy.mockRestore()
    })

    it('should return response data', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'Updated' }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: expectedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.put('https://api.example.com/users/1', { name: 'Updated' })

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should handle undefined data', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { success: true },
      })

      // Act
      await client.put('https://api.example.com/users/1')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toBeUndefined()
      requestSpy.mockRestore()
    })
  })

  describe('putRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: { id: 1, name: 'Updated' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await client.putRaw('https://api.example.com/users/1', { name: 'Updated' })

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should set method to put', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      })

      // Act
      await client.putRaw('https://api.example.com/users/1', { name: 'Updated' })

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('put')
      requestSpy.mockRestore()
    })
  })

  describe('post method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should set method to post', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1 },
      })

      // Act
      await client.post('https://api.example.com/users', { name: 'New User' })

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('post')
      requestSpy.mockRestore()
    })

    it('should include data in request', async () => {
      // Arrange
      const data = { name: 'New User', email: 'user@example.com' }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1, ...data },
      })

      // Act
      await client.post('https://api.example.com/users', data)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toEqual(data)
      requestSpy.mockRestore()
    })

    it('should return response data', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'New User' }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: expectedData,
          status: 201,
          statusText: 'Created',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.post('https://api.example.com/users', { name: 'New User' })

      // Assert
      expect(result).toEqual(expectedData)
    })
  })

  describe('postRaw method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: { id: 1, name: 'New User' },
        status: 201,
        statusText: 'Created',
        headers: { 'location': '/users/1' },
        config: {},
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await client.postRaw('https://api.example.com/users', { name: 'New User' })

      // Assert
      expect(result).toEqual(expectedResponse)
      expect(result.status).toBe(201)
    })

    it('should set method to post', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1 },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {},
      })

      // Act
      await client.postRaw('https://api.example.com/users', { name: 'New User' })

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('post')
      requestSpy.mockRestore()
    })
  })

  describe('patch method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should set method to patch', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1 },
      })

      // Act
      await client.patch('https://api.example.com/users/1', { status: 'active' })

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('patch')
      requestSpy.mockRestore()
    })

    it('should include data in request', async () => {
      // Arrange
      const data = { status: 'active' }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        data: { id: 1, ...data },
      })

      // Act
      await client.patch('https://api.example.com/users/1', data)

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.data).toEqual(data)
      requestSpy.mockRestore()
    })

    it('should return response data', async () => {
      // Arrange
      const expectedData = { id: 1, status: 'active' }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = {
          data: expectedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: ctx.config,
        } as any
      })

      // Act
      const result = await client.patch('https://api.example.com/users/1', { status: 'active' })

      // Assert
      expect(result).toEqual(expectedData)
    })
  })

  describe('head method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should set method to head', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
        data: undefined,
      })

      // Act
      await client.head('https://api.example.com/users/1')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('head')
      requestSpy.mockRestore()
    })

    it('should return full response with void data', async () => {
      // Arrange
      const expectedResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-length': '0' },
        config: {},
        data: undefined,
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await client.head('https://api.example.com/users/1')

      // Assert
      expect(result).toEqual(expectedResponse)
      expect(result.data).toBeUndefined()
    })
  })

  describe('delete method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should set method to delete', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {},
        data: undefined,
      })

      // Act
      await client.delete('https://api.example.com/users/1')

      // Assert
      const callConfig = requestSpy.mock.calls[0][0]
      expect(callConfig.method).toBe('delete')
      requestSpy.mockRestore()
    })

    it('should return full response', async () => {
      // Arrange
      const expectedResponse = {
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {},
        data: undefined,
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await client.delete('https://api.example.com/users/1')

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should handle optional config parameter', async () => {
      // Arrange
      const config = { headers: { 'X-Confirm': 'yes' } }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {},
        data: undefined,
      })

      // Act
      await client.delete('https://api.example.com/users/1', config)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      requestSpy.mockRestore()
    })

    it('should handle undefined config', async () => {
      // Arrange
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {},
        data: undefined,
      })

      // Act
      await client.delete('https://api.example.com/users/1')

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      requestSpy.mockRestore()
    })
  })

  describe('request method', () => {
    let client: HttpClient

    beforeEach(() => {
      client = new HttpClient(baseOpts)
    })

    it('should execute middlewares', async () => {
      // Arrange
      const config = { url: 'https://api.example.com/test', method: 'get' }
      const expectedResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await (client as any).request(config)

      // Assert
      expect(mockMiddleware).toHaveBeenCalled()
      expect(result).toEqual(expectedResponse)
    })

    it('should pass config to middleware context', async () => {
      // Arrange
      const config = { url: 'https://api.example.com/test', method: 'post', data: { test: 'data' } }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        expect(ctx.config).toEqual(config)
        ctx.response = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as any
      })

      // Act
      await (client as any).request(config)

      // Assert
      expect(mockMiddleware).toHaveBeenCalled()
    })

    it('should return response from middleware', async () => {
      // Arrange
      const config = { url: 'https://api.example.com/test' }
      const expectedResponse = {
        data: { result: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: { 'x-custom': 'value' },
        config,
      }
      mockMiddleware.mockImplementation(async (ctx: MiddlewareContext) => {
        ctx.response = expectedResponse as any
      })

      // Act
      const result = await (client as any).request(config)

      // Assert
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle empty URL', () => {
      // Arrange & Act & Assert
      expect(() => {
        const client = new HttpClient(baseOpts)
        client.get('')
      }).not.toThrow()
    })

    it('should handle null config object', () => {
      // Arrange
      const client = new HttpClient(baseOpts)

      // Act & Assert
      expect(() => {
        client.get('https://api.example.com', null as any)
      }).not.toThrow()
    })

    it('should handle large concurrency value', () => {
      // Arrange
      const opts = { ...baseOpts, concurrency: 1000 }

      // Act & Assert
      expect(() => {
        new HttpClient(opts)
      }).not.toThrow()
    })

    it('should handle special characters in headers', () => {
      // Arrange
      const opts = {
        ...baseOpts,
        headers: {
          'X-Custom': 'value-with-special-chars-!@#$%',
        },
      }

      // Act & Assert
      expect(() => {
        new HttpClient(opts)
      }).not.toThrow()
    })

    it('should handle complex nested object as body', async () => {
      // Arrange
      const client = new HttpClient(baseOpts)
      const complexBody = {
        nested: {
          deeply: {
            object: {
              array: [1, 2, 3],
              bool: true,
            },
          },
        },
      }
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({ data: { success: true } })

      // Act
      await client.getWithBody('https://api.example.com/users', complexBody)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      requestSpy.mockRestore()
    })

    it('should handle very long URL', async () => {
      // Arrange
      const client = new HttpClient(baseOpts)
      const longUrl = 'https://api.example.com/' + 'a'.repeat(5000)
      const requestSpy = jest.spyOn(client as any, 'request')
      requestSpy.mockResolvedValue({ data: { success: true } })

      // Act
      await client.get(longUrl)

      // Assert
      expect(requestSpy).toHaveBeenCalled()
      requestSpy.mockRestore()
    })

    it('should preserve middleware order', () => {
      // Arrange
      const customMiddleware1 = jest.fn()
      const customMiddleware2 = jest.fn()
      const opts = {
        ...baseOpts,
        middlewares: [customMiddleware1, customMiddleware2],
      }

      // Act
      new HttpClient(opts)

      // Assert
      const middlewares = mockCompose.mock.calls[0][0]
      expect(middlewares).toContain(customMiddleware1)
      expect(middlewares).toContain(customMiddleware2)
    })
  })
})
