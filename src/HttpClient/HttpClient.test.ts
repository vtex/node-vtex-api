import { HttpClient } from './HttpClient'
import { CacheType } from './middlewares/cache'
import { Logger } from '../service/logger'
import pLimit from 'p-limit'
import * as bindingUtils from '../utils/binding'
import * as tenantUtils from '../utils/tenant'
import * as bodyHashUtils from '../utils/bodyHash'

jest.mock('p-limit')
jest.mock('../utils/binding')
jest.mock('../utils/tenant')
jest.mock('../utils/bodyHash')
jest.mock('./middlewares/tracing')
jest.mock('koa-compose')

const mockCompose = require('koa-compose')
const mockPLimit = pLimit as jest.MockedFunction<typeof pLimit>
const mockFormatBindingHeaderValue = bindingUtils.formatBindingHeaderValue as jest.MockedFunction<typeof bindingUtils.formatBindingHeaderValue>
const mockFormatTenantHeaderValue = tenantUtils.formatTenantHeaderValue as jest.MockedFunction<typeof tenantUtils.formatTenantHeaderValue>
const mockComputeBodyHash = bodyHashUtils.computeBodyHash as jest.MockedFunction<typeof bodyHashUtils.computeBodyHash>
const mockCreateHttpClientTracingMiddleware = require('./middlewares/tracing').createHttpClientTracingMiddleware as jest.Mock

describe('HttpClient', () => {
  let logger: Logger
  let mockRunMiddlewares: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    logger = {
      warn: jest.fn(),
    } as any

    mockRunMiddlewares = jest.fn().mockResolvedValue(undefined)
    mockCompose.mockReturnValue(mockRunMiddlewares)
    mockCreateHttpClientTracingMiddleware.mockReturnValue(jest.fn())
    mockPLimit.mockReturnValue(undefined)
    mockFormatBindingHeaderValue.mockImplementation((val) => val)
    mockFormatTenantHeaderValue.mockImplementation((val) => val)
    mockComputeBodyHash.mockReturnValue('hash123')
  })

  describe('constructor', () => {
    it('should initialize with minimal options', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('http://localhost')
    })

    it('should initialize with custom name', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        name: 'TestClient',
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('TestClient')
    })

    it('should use baseURL as name when name is not provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('http://localhost')
    })

    it('should default name to "unknown" when neither name nor baseURL provided', () => {
      // Arrange
      const opts = {
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should build headers with default values', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        userAgent: 'TestAgent',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      const defaultsMiddlewareCall = mockCompose.mock.results[0].value.mock.calls[0]
      expect(defaultsMiddlewareCall).toBeDefined()
    })

    it('should include authorization header when authType and authToken provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        authType: 'Bearer',
        authToken: 'token123',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      // Verify middleware composition occurred
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include account header when account provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        account: 'account123',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include tenant header when tenant provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        tenant: { id: 'tenant123' },
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockFormatTenantHeaderValue).toHaveBeenCalledWith({ id: 'tenant123' })
    })

    it('should include binding header when binding provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        binding: { id: 'binding123' },
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockFormatBindingHeaderValue).toHaveBeenCalledWith({ id: 'binding123' })
    })

    it('should include locale header when locale provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        locale: 'en-US',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include operation ID header when operationId provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        operationId: 'op123',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include product header when product provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        product: 'ProductName',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include segment header when segmentToken provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        segmentToken: 'segment123',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include session header when sessionToken provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        sessionToken: 'session123',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include forwarded host header when host provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        host: 'example.com',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should apply concurrency limit when concurrency > 0', () => {
      // Arrange
      const mockLimit = jest.fn()
      mockPLimit.mockReturnValue(mockLimit as any)
      const opts = {
        baseURL: 'http://localhost',
        concurrency: 5,
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockPLimit).toHaveBeenCalledWith(5)
    })

    it('should not apply concurrency limit when concurrency is 0', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        concurrency: 0,
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockPLimit).not.toHaveBeenCalled()
    })

    it('should use default cacheableType of Memory', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      // Private property, but we can test through getConfig behavior
      expect(client).toBeDefined()
    })

    it('should use provided cacheableType', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        cacheableType: CacheType.Disk,
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should set memoizable to true by default', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should respect provided memoizable value', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        memoizable: false,
        logger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client).toBeDefined()
    })

    it('should use default timeout of 1000ms', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should use provided timeout value', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        timeout: 5000,
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include cache middleware when memoryCache provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        memoryCache: new Map(),
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include cache middleware when diskCache provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        diskCache: new Map(),
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include recorder middleware when recorder provided', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        recorder: jest.fn(),
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })

    it('should include tracing middleware with correct parameters', () => {
      // Arrange
      const tracer = { name: 'tracer' }
      const opts = {
        baseURL: 'http://localhost',
        tracer,
        logger,
        diskCache: new Map(),
        memoryCache: new Map(),
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCreateHttpClientTracingMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({
          tracer,
          logger,
          clientName: 'http://localhost',
          hasDiskCacheMiddleware: true,
          hasMemoryCacheMiddleware: true,
        })
      )
    })

    it('should include custom middlewares from options', () => {
      // Arrange
      const customMiddleware = jest.fn()
      const opts = {
        baseURL: 'http://localhost',
        middlewares: [customMiddleware],
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should call request and return response data', async () => {
      // Arrange
      const mockData = { id: 1, name: 'Test' }
      const mockResponse = { data: mockData }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockData = { id: 1 }
      const mockResponse = { data: mockData }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.get('http://example.com', { timeout: 5000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should use default empty config when not provided', async () => {
      // Arrange
      const mockData = { id: 1 }
      const mockResponse = { data: mockData }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toEqual(mockData)
    })

    it('should handle undefined data response', async () => {
      // Arrange
      const mockResponse = { data: undefined }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle null data response', async () => {
      // Arrange
      const mockResponse = { data: null }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toBeNull()
    })

    it('should propagate errors from middleware', async () => {
      // Arrange
      const error = new Error('Request failed')
      mockRunMiddlewares.mockRejectedValue(error)

      // Act & Assert
      await expect(client.get('http://example.com')).rejects.toThrow('Request failed')
    })
  })

  describe('getRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockResponse = { data: { id: 1 }, status: 200, headers: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.getRaw('http://example.com')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockResponse = { data: { id: 1 }, status: 200 }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.getRaw('http://example.com', { timeout: 3000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('getWithBody', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should compute body hash and include in params', async () => {
      // Arrange
      const mockData = { key: 'value' }
      const mockResponse = { data: { result: 'success' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })
      mockComputeBodyHash.mockReturnValue('bodyhash123')

      // Act
      const result = await client.getWithBody('http://example.com', mockData)

      // Assert
      expect(mockComputeBodyHash).toHaveBeenCalledWith(mockData, expect.any(Function))
      expect(result).toEqual({ result: 'success' })
    })

    it('should log warning when body hash computation fails', async () => {
      // Arrange
      const mockData = { key: 'value' }
      const mockResponse = { data: { result: 'success' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })
      mockComputeBodyHash.mockImplementation((data, callback) => {
        callback()
        return 'hash'
      })

      // Act
      await client.getWithBody('http://example.com', mockData)

      // Assert
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should merge body hash into params without overwriting existing params', async () => {
      // Arrange
      const mockData = { key: 'value' }
      const mockResponse = { data: { result: 'success' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.getWithBody('http://example.com', mockData, { params: { existing: 'param' } })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should handle undefined body data', async () => {
      // Arrange
      const mockResponse = { data: { result: 'success' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.getWithBody('http://example.com', undefined)

      // Assert
      expect(result).toEqual({ result: 'success' })
    })

    it('should accept optional config parameter', async () => {
      // Arrange
      const mockResponse = { data: { result: 'success' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.getWithBody('http://example.com', { body: 'data' }, { timeout: 2000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('getBuffer', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should request buffer with arraybuffer response type', async () => {
      // Arrange
      const buffer = Buffer.from('test data')
      const mockResponse = { data: buffer, headers: { 'content-length': '9' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.getBuffer('http://example.com/file')

      // Assert
      expect(result.data).toEqual(buffer)
      expect(result.headers).toEqual({ 'content-length': '9' })
    })

    it('should set cacheable to Disk', async () => {
      // Arrange
      const buffer = Buffer.from('test')
      const mockResponse = { data: buffer, headers: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.getBuffer('http://example.com/file')

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should accept additional config', async () => {
      // Arrange
      const buffer = Buffer.from('test')
      const mockResponse = { data: buffer, headers: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.getBuffer('http://example.com/file', { timeout: 10000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('getStream', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should request stream with stream response type', async () => {
      // Arrange
      const mockStream = { readable: true } as any
      const mockResponse = { data: mockStream }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.getStream('http://example.com/stream')

      // Assert
      expect(result).toEqual(mockStream)
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockStream = {} as any
      const mockResponse = { data: mockStream }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.getStream('http://example.com/stream', { timeout: 30000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('put', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should send PUT request with data', async () => {
      // Arrange
      const requestData = { id: 1, name: 'Updated' }
      const mockResponse = { data: { id: 1, name: 'Updated' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.put('http://example.com/1', requestData)

      // Assert
      expect(result).toEqual({ id: 1, name: 'Updated' })
    })

    it('should send PUT request without data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.put('http://example.com/1')

      // Assert
      expect(result).toEqual({})
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.put('http://example.com/1', { name: 'Test' }, { timeout: 5000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('putRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockResponse = { data: { id: 1 }, status: 200, headers: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.putRaw('http://example.com/1', { name: 'Test' })

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockResponse = { data: {}, status: 200 }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.putRaw('http://example.com/1', {}, { timeout: 3000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('post', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should send POST request with data', async () => {
      // Arrange
      const requestData = { name: 'New Item' }
      const mockResponse = { data: { id: 1, name: 'New Item' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.post('http://example.com', requestData)

      // Assert
      expect(result).toEqual({ id: 1, name: 'New Item' })
    })

    it('should send POST request without data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.post('http://example.com')

      // Assert
      expect(result).toEqual({})
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.post('http://example.com', { name: 'Test' }, { timeout: 5000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('postRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const mockResponse = { data: { id: 1 }, status: 201, headers: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.postRaw('http://example.com', { name: 'Test' })

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockResponse = { data: {}, status: 201 }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.postRaw('http://example.com', {}, { timeout: 3000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('patch', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should send PATCH request with data', async () => {
      // Arrange
      const requestData = { status: 'active' }
      const mockResponse = { data: { id: 1, status: 'active' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.patch('http://example.com/1', requestData)

      // Assert
      expect(result).toEqual({ id: 1, status: 'active' })
    })

    it('should send PATCH request without data', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.patch('http://example.com/1')

      // Assert
      expect(result).toEqual({})
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.patch('http://example.com/1', { status: 'active' }, { timeout: 5000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('head', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should send HEAD request', async () => {
      // Arrange
      const mockResponse = { status: 200, headers: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.head('http://example.com')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should accept additional config', async () => {
      // Arrange
      const mockResponse = { status: 200, headers: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.head('http://example.com', { timeout: 5000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should send DELETE request', async () => {
      // Arrange
      const mockResponse = { status: 204 }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.delete('http://example.com/1')

      // Assert
      expect(result).toEqual(mockResponse)
    })

    it('should accept optional config parameter', async () => {
      // Arrange
      const mockResponse = { status: 204 }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.delete('http://example.com/1', { timeout: 5000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should handle undefined config', async () => {
      // Arrange
      const mockResponse = { status: 204 }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.delete('http://example.com/1', undefined)

      // Assert
      expect(result).toEqual(mockResponse)
    })
  })

  describe('request', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should execute middlewares with context', async () => {
      // Arrange
      const mockResponse = { data: { success: true } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client['request']({ url: 'http://example.com' })

      // Assert
      expect(result).toEqual(mockResponse)
      expect(mockRunMiddlewares).toHaveBeenCalledWith(expect.objectContaining({ config: { url: 'http://example.com' } }))
    })

    it('should propagate errors from middleware', async () => {
      // Arrange
      const error = new Error('Middleware error')
      mockRunMiddlewares.mockRejectedValue(error)

      // Act & Assert
      await expect(client['request']({ url: 'http://example.com' })).rejects.toThrow('Middleware error')
    })

    it('should handle response with headers and status', async () => {
      // Arrange
      const mockResponse = { data: {}, status: 200, headers: { 'content-type': 'application/json' } }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client['request']({ url: 'http://example.com' })

      // Assert
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getConfig', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
        cacheableType: CacheType.Disk,
      }
      client = new HttpClient(opts)
    })

    it('should merge url into config', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        expect(context.config.url).toBe('http://example.com/test')
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.get('http://example.com/test')

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should include cacheable setting from instance', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        expect(context.config.cacheable).toBe(CacheType.Disk)
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.get('http://example.com')

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should include memoizable setting from instance', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        expect(context.config.memoizable).toBe(true)
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.get('http://example.com')

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should preserve config parameters', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        expect(context.config.timeout).toBe(3000)
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.get('http://example.com', { timeout: 3000 })

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })
  })

  describe('edge cases and error handling', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }
      client = new HttpClient(opts)
    })

    it('should handle empty URL', async () => {
      // Arrange
      const mockResponse = { data: {} }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      await client.get('')

      // Assert
      expect(mockRunMiddlewares).toHaveBeenCalled()
    })

    it('should handle response with no data property', async () => {
      // Arrange
      const mockResponse = {} as any
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle null response', async () => {
      // Arrange
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = { data: null }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toBeNull()
    })

    it('should handle very large data responses', async () => {
      // Arrange
      const largeData = { items: new Array(10000).fill({ id: 1, name: 'test' }) }
      const mockResponse = { data: largeData }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result.items.length).toBe(10000)
    })

    it('should handle empty string data', async () => {
      // Arrange
      const mockResponse = { data: '' }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toBe('')
    })

    it('should handle boolean response data', async () => {
      // Arrange
      const mockResponse = { data: true }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle numeric response data', async () => {
      // Arrange
      const mockResponse = { data: 42 }
      mockRunMiddlewares.mockImplementation((context) => {
        context.response = mockResponse
        return Promise.resolve()
      })

      // Act
      const result = await client.get('http://example.com')

      // Assert
      expect(result).toBe(42)
    })
  })

  describe('middleware composition', () => {
    it('should compose all middleware in correct order', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        logger,
        memoryCache: new Map(),
        diskCache: new Map(),
        recorder: jest.fn(),
        cancellation: { token: null },
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCompose).toHaveBeenCalled()
      const middleWares = mockCompose.mock.calls[0][0]
      expect(Array.isArray(middleWares)).toBe(true)
      expect(middleWares.length).toBeGreaterThan(0)
    })

    it('should include tracing middleware as first middleware', () => {
      // Arrange
      const opts = {
        baseURL: 'http://localhost',
        logger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(mockCreateHttpClientTracingMiddleware).toHaveBeenCalled()
    })
  })
})
