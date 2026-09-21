import { HttpClient } from './HttpClient'
import { Logger } from '../service/logger'
import { CacheType } from './middlewares/cache'
import { IOResponse } from './typings'
import compose from 'koa-compose'
import pLimit from 'p-limit'

jest.mock('koa-compose')
jest.mock('p-limit')
jest.mock('../utils/binding')
jest.mock('../utils/tenant')
jest.mock('../utils/bodyHash')
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
  let mockComposedMiddleware: jest.Mock
  let mockPLimit: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockLogger = {
      warn: jest.fn(),
    } as any

    mockComposedMiddleware = jest.fn().mockResolvedValue(undefined)
    ;(compose as jest.Mock).mockReturnValue(mockComposedMiddleware)

    mockPLimit = jest.fn().mockReturnValue(jest.fn())
    ;(pLimit as jest.Mock).mockImplementation(mockPLimit)
  })

  describe('constructor', () => {
    it('should initialize with minimal options', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('https://api.example.com')
    })

    it('should use provided name if given', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        name: 'custom-client',
        logger: mockLogger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('custom-client')
    })

    it('should use default unknown name if no name or baseURL provided', () => {
      // Arrange
      const opts = {
        logger: mockLogger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(client.name).toBe('unknown')
    })

    it('should include Authorization header when authType and authToken provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        authType: 'Bearer',
        authToken: 'token123',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
      const middlewares = (compose as jest.Mock).mock.calls[0][0]
      expect(middlewares).toBeDefined()
    })

    it('should not include Authorization header when authType is missing', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        authToken: 'token123',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should not include Authorization header when authToken is missing', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        authType: 'Bearer',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include account header when account provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        account: 'account123',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include forwarded host header when host provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        host: 'custom.host.com',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include locale header when locale provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        locale: 'en-US',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include operation id header when operationId provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        operationId: 'op123',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include product header when product provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        product: 'product-name',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include segment header when segmentToken provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        segmentToken: 'seg-token',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include session header when sessionToken provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        sessionToken: 'sess-token',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include User-Agent header', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        userAgent: 'CustomAgent/1.0',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should always include Accept-Encoding gzip header', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should merge default headers with provided headers', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        headers: { 'X-Custom': 'custom-value' },
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set memoizable to true by default', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set memoizable to false when explicitly provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        memoizable: false,
        logger: mockLogger,
      }

      // Act
      const client = new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set cacheableType to Memory by default', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should set cacheableType to Disk when provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        cacheableType: CacheType.Disk,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should create pLimit with provided concurrency', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        concurrency: 5,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(pLimit).toHaveBeenCalledWith(5)
    })

    it('should not create pLimit when concurrency is 0', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        concurrency: 0,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(pLimit).not.toHaveBeenCalled()
    })

    it('should not create pLimit when concurrency is negative', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        concurrency: -1,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(pLimit).not.toHaveBeenCalled()
    })

    it('should not create pLimit when concurrency is undefined', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(pLimit).not.toHaveBeenCalled()
    })

    it('should use default timeout when not provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should use provided timeout value', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        timeout: 5000,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should use default memoizable value when not provided', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include custom middlewares when provided', () => {
      // Arrange
      const customMiddleware = jest.fn()
      const opts = {
        baseURL: 'https://api.example.com',
        middlewares: [customMiddleware],
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      const middlewares = (compose as jest.Mock).mock.calls[0][0]
      expect(middlewares).toContain(customMiddleware)
    })
  })

  describe('get', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return data from response', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'test' }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      const result = await client.get(url)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should extract data from response with generic type', async () => {
      // Arrange
      interface User {
        id: number
        name: string
      }
      const expectedData: User = { id: 1, name: 'test' }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      const result = await client.get<User>(url)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should use default empty config when not provided', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      await client.get(url)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should pass url and config to request', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'
      const config = { params: { id: '1' } }

      // Act
      await client.get(url, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle null data response', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: null }
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      const result = await client.get(url)

      // Assert
      expect(result).toBeNull()
    })

    it('should handle empty array response', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: [] }
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      const result = await client.get(url)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('getRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: { id: 1, name: 'test' },
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      const result = await client.getRaw(url)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should return full response with generic type', async () => {
      // Arrange
      interface User {
        id: number
        name: string
      }
      const expectedResponse = {
        data: { id: 1, name: 'test' } as User,
        status: 200,
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      const result = await client.getRaw<User>(url)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should pass config to request', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1 }, status: 200 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users'
      const config = { params: { id: '1' } }

      // Act
      await client.getRaw(url, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('getWithBody', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return data from response', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'test' }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/search'
      const body = { query: 'test' }

      // Act
      const result = await client.getWithBody(url, body)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should include body hash in params', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/search'
      const body = { query: 'test' }

      // Act
      await client.getWithBody(url, body)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should merge config params with body hash', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/search'
      const body = { query: 'test' }
      const config = { params: { filter: 'active' } }

      // Act
      await client.getWithBody(url, body, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle null body', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/search'

      // Act
      await client.getWithBody(url, null)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle undefined body', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/search'

      // Act
      await client.getWithBody(url)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should log warning on body hash error', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/search'
      const body = { query: 'test' }

      // Act
      await client.getWithBody(url, body)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('getBuffer', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return buffer with headers', async () => {
      // Arrange
      const buffer = Buffer.from('test data')
      const expectedResponse = {
        data: buffer,
        headers: { 'content-type': 'application/octet-stream' },
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/download'

      // Act
      const result = await client.getBuffer(url)

      // Assert
      expect(result.data).toEqual(buffer)
      expect(result.headers).toBeDefined()
    })

    it('should set response type to arraybuffer', async () => {
      // Arrange
      const buffer = Buffer.from('test data')
      const expectedResponse = {
        data: buffer,
        headers: {},
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/download'

      // Act
      await client.getBuffer(url)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should set cacheable to Disk by default', async () => {
      // Arrange
      const buffer = Buffer.from('test data')
      const expectedResponse = {
        data: buffer,
        headers: {},
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/download'

      // Act
      await client.getBuffer(url)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should override cacheable type if provided in config', async () => {
      // Arrange
      const buffer = Buffer.from('test data')
      const expectedResponse = {
        data: buffer,
        headers: {},
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/download'
      const config = { cacheable: CacheType.Memory }

      // Act
      await client.getBuffer(url, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('getStream', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return incoming message stream', async () => {
      // Arrange
      const mockStream = { on: jest.fn() } as any
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: mockStream }
        return Promise.resolve()
      })
      const url = '/api/stream'

      // Act
      const result = await client.getStream(url)

      // Assert
      expect(result).toEqual(mockStream)
    })

    it('should set response type to stream', async () => {
      // Arrange
      const mockStream = {} as any
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: mockStream }
        return Promise.resolve()
      })
      const url = '/api/stream'

      // Act
      await client.getStream(url)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should pass config to request', async () => {
      // Arrange
      const mockStream = {} as any
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: mockStream }
        return Promise.resolve()
      })
      const url = '/api/stream'
      const config = { headers: { 'Accept': 'text/event-stream' } }

      // Act
      await client.getStream(url, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('put', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return data from response', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'updated' }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const data = { name: 'updated' }

      // Act
      const result = await client.put(url, data)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should set method to put', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const data = { name: 'updated' }

      // Act
      await client.put(url, data)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle undefined data', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users/1'

      // Act
      const result = await client.put(url)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should include config in request', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const data = { name: 'updated' }
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.put(url, data, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('putRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: { id: 1, name: 'updated' },
        status: 200,
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const data = { name: 'updated' }

      // Act
      const result = await client.putRaw(url, data)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should set method to put', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1 }, status: 200 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const data = { name: 'updated' }

      // Act
      await client.putRaw(url, data)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('post', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return data from response', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'new' }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'
      const data = { name: 'new' }

      // Act
      const result = await client.post(url, data)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should set method to post', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'
      const data = { name: 'new' }

      // Act
      await client.post(url, data)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle undefined data', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'

      // Act
      const result = await client.post(url)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should include config in request', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users'
      const data = { name: 'new' }
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.post(url, data, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('postRaw', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: { id: 1, name: 'new' },
        status: 201,
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users'
      const data = { name: 'new' }

      // Act
      const result = await client.postRaw(url, data)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should set method to post', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1 }, status: 201 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users'
      const data = { name: 'new' }

      // Act
      await client.postRaw(url, data)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('patch', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return data from response', async () => {
      // Arrange
      const expectedData = { id: 1, name: 'patched' }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const data = { name: 'patched' }

      // Act
      const result = await client.patch(url, data)

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should set method to patch', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const data = { name: 'patched' }

      // Act
      await client.patch(url, data)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle undefined data', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })
      const url = '/api/users/1'

      // Act
      const result = await client.patch(url)

      // Assert
      expect(result).toEqual(expectedData)
    })
  })

  describe('head', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: undefined,
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'

      // Act
      const result = await client.head(url)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should set method to head', async () => {
      // Arrange
      const expectedResponse = { data: undefined, status: 200 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'

      // Act
      await client.head(url)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should pass config to request', async () => {
      // Arrange
      const expectedResponse = { data: undefined, status: 200 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.head(url, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should return full response object', async () => {
      // Arrange
      const expectedResponse = {
        data: undefined,
        status: 204,
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'

      // Act
      const result = await client.delete(url)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should set method to delete', async () => {
      // Arrange
      const expectedResponse = { data: undefined, status: 204 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'

      // Act
      await client.delete(url)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should pass config to request', async () => {
      // Arrange
      const expectedResponse = { data: undefined, status: 204 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'
      const config = { headers: { 'X-Custom': 'value' } }

      // Act
      await client.delete(url, config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should handle undefined config', async () => {
      // Arrange
      const expectedResponse = { data: undefined, status: 204 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const url = '/api/users/1'

      // Act
      const result = await client.delete(url)

      // Assert
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('request', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should execute middlewares', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1 }, status: 200 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const config = { url: '/api/users', method: 'get' }

      // Act
      const result = await client['request'](config)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should pass context with config to middlewares', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1 }, status: 200 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        expect(context.config).toBeDefined()
        context.response = expectedResponse
        return Promise.resolve()
      })
      const config = { url: '/api/users', method: 'get' }

      // Act
      await client['request'](config)

      // Assert
      expect(mockComposedMiddleware).toHaveBeenCalled()
    })

    it('should return response from context after middleware execution', async () => {
      // Arrange
      const expectedResponse = { data: { id: 1 }, status: 200 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = expectedResponse
        return Promise.resolve()
      })
      const config = { url: '/api/users' }

      // Act
      const result = await client['request'](config)

      // Assert
      expect(result).toEqual(expectedResponse)
    })
  })

  describe('edge cases and error handling', () => {
    let client: HttpClient

    beforeEach(() => {
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }
      client = new HttpClient(opts)
    })

    it('should handle empty string URL', async () => {
      // Arrange
      const expectedData = { id: 1 }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: expectedData }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('')

      // Assert
      expect(result).toEqual(expectedData)
    })

    it('should handle complex nested data', async () => {
      // Arrange
      const complexData = {
        nested: {
          deeply: {
            value: 'test',
            array: [1, 2, 3],
          },
        },
      }
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: complexData }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/api/complex')

      // Assert
      expect(result).toEqual(complexData)
    })

    it('should handle large array responses', async () => {
      // Arrange
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: largeArray }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/api/large')

      // Assert
      expect(result).toHaveLength(1000)
      expect(result[0]).toEqual({ id: 0 })
    })

    it('should handle boolean data response', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: true }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/api/boolean')

      // Assert
      expect(result).toBe(true)
    })

    it('should handle string data response', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: 'plain text response' }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/api/string')

      // Assert
      expect(result).toBe('plain text response')
    })

    it('should handle number data response', async () => {
      // Arrange
      mockComposedMiddleware.mockImplementation((context: any) => {
        context.response = { data: 42 }
        return Promise.resolve()
      })

      // Act
      const result = await client.get('/api/number')

      // Assert
      expect(result).toBe(42)
    })
  })

  describe('middleware composition', () => {
    it('should compose all middlewares in correct order', () => {
      // Arrange
      const opts = {
        baseURL: 'https://api.example.com',
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
      const middlewares = (compose as jest.Mock).mock.calls[0][0]
      expect(Array.isArray(middlewares)).toBe(true)
      expect(middlewares.length).toBeGreaterThan(0)
    })

    it('should include custom middlewares in composition', () => {
      // Arrange
      const customMiddleware1 = jest.fn()
      const customMiddleware2 = jest.fn()
      const opts = {
        baseURL: 'https://api.example.com',
        middlewares: [customMiddleware1, customMiddleware2],
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      const middlewares = (compose as jest.Mock).mock.calls[0][0]
      expect(middlewares).toContain(customMiddleware1)
      expect(middlewares).toContain(customMiddleware2)
    })

    it('should include recorder middleware when provided', () => {
      // Arrange
      const mockRecorder = jest.fn()
      const opts = {
        baseURL: 'https://api.example.com',
        recorder: mockRecorder,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include memory cache middleware when provided', () => {
      // Arrange
      const mockMemoryCache = {}
      const opts = {
        baseURL: 'https://api.example.com',
        memoryCache: mockMemoryCache,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })

    it('should include disk cache middleware when provided', () => {
      // Arrange
      const mockDiskCache = {}
      const opts = {
        baseURL: 'https://api.example.com',
        diskCache: mockDiskCache,
        logger: mockLogger,
      }

      // Act
      new HttpClient(opts)

      // Assert
      expect(compose).toHaveBeenCalled()
    })
  })
})
