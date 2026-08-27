import { addRequestMetricsMiddleware } from './requestMetricsMiddleware'
import * as stream from 'stream'
import { hrToMillisFloat } from '../../utils'
import {
  createConcurrentRequestsInstrument,
  createRequestsResponseSizesInstrument,
  createRequestsTimingsInstrument,
  createTotalAbortedRequestsInstrument,
  createTotalRequestsInstrument,
  RequestsMetricLabels,
} from '../tracing/metrics/instruments'
import { ServiceContext } from '../worker/runtime/typings'
import { requestHandlerLabel } from './requestHandlerLabel'

jest.mock('stream')
jest.mock('../../utils')
jest.mock('../tracing/metrics/instruments')
jest.mock('./requestHandlerLabel')

describe('requestMetricsMiddleware', () => {
  let mockConcurrentRequests: any
  let mockRequestTimings: any
  let mockTotalRequests: any
  let mockResponseSizes: any
  let mockAbortedRequests: any
  let mockCtx: Partial<ServiceContext>
  let mockReq: any
  let mockRes: any
  let mockNext: jest.Mock

  beforeEach(() => {
    // Setup instrument mocks
    mockConcurrentRequests = {
      inc: jest.fn(),
      dec: jest.fn(),
    }
    mockRequestTimings = {
      observe: jest.fn(),
    }
    mockTotalRequests = {
      inc: jest.fn(),
    }
    mockResponseSizes = {
      observe: jest.fn(),
    }
    mockAbortedRequests = {
      inc: jest.fn(),
    }

    ;(createConcurrentRequestsInstrument as jest.Mock).mockReturnValue(mockConcurrentRequests)
    ;(createRequestsTimingsInstrument as jest.Mock).mockReturnValue(mockRequestTimings)
    ;(createTotalRequestsInstrument as jest.Mock).mockReturnValue(mockTotalRequests)
    ;(createRequestsResponseSizesInstrument as jest.Mock).mockReturnValue(mockResponseSizes)
    ;(createTotalAbortedRequestsInstrument as jest.Mock).mockReturnValue(mockAbortedRequests)

    // Setup context mocks
    mockReq = {
      once: jest.fn(),
    }
    mockRes = {
      once: jest.fn(),
    }

    mockCtx = {
      req: mockReq,
      res: mockRes,
      response: {
        length: 0,
        status: 200,
      },
      requestHandlerName: 'testHandler',
    } as any

    mockNext = jest.fn().mockResolvedValue(undefined)

    ;(requestHandlerLabel as jest.Mock).mockReturnValue('test-handler-label')
    ;(hrToMillisFloat as jest.Mock).mockReturnValue(42.5)

    jest.clearAllMocks()
  })

  describe('addRequestMetricsMiddleware', () => {
    it('should create and return a middleware function', () => {
      // Arrange & Act
      const middleware = addRequestMetricsMiddleware()

      // Assert
      expect(middleware).toBeDefined()
      expect(typeof middleware).toBe('function')
    })

    it('should create all required instruments', () => {
      // Arrange & Act
      addRequestMetricsMiddleware()

      // Assert
      expect(createConcurrentRequestsInstrument).toHaveBeenCalledTimes(1)
      expect(createRequestsTimingsInstrument).toHaveBeenCalledTimes(1)
      expect(createTotalRequestsInstrument).toHaveBeenCalledTimes(1)
      expect(createRequestsResponseSizesInstrument).toHaveBeenCalledTimes(1)
      expect(createTotalAbortedRequestsInstrument).toHaveBeenCalledTimes(1)
    })
  })

  describe('addRequestMetrics middleware', () => {
    it('should increment concurrent requests on invocation', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockConcurrentRequests.inc).toHaveBeenCalledWith(1)
    })

    it('should register abort listener on request', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockReq.once).toHaveBeenCalledWith('aborted', expect.any(Function))
    })

    it('should register close listener on response', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockRes.once).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should call next function', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockNext).toHaveBeenCalled()
    })

    it('should decrement concurrent requests after completion', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockConcurrentRequests.dec).toHaveBeenCalledWith(1)
    })

    it('should increment total requests with correct labels', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockTotalRequests.inc).toHaveBeenCalledWith(
        {
          [RequestsMetricLabels.REQUEST_HANDLER]: 'test-handler-label',
          [RequestsMetricLabels.STATUS_CODE]: 200,
        },
        1
      )
    })

    it('should observe response timing with correct labels and value', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockRequestTimings.observe).toHaveBeenCalledWith(
        {
          [RequestsMetricLabels.REQUEST_HANDLER]: 'test-handler-label',
        },
        42.5
      )
    })

    it('should observe response size when response has length', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(mockCtx.response as any).length = 1024
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockResponseSizes.observe).toHaveBeenCalledWith(
        {
          [RequestsMetricLabels.REQUEST_HANDLER]: 'test-handler-label',
        },
        1024
      )
    })

    it('should not observe response size when response length is zero', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(mockCtx.response as any).length = 0
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockResponseSizes.observe).not.toHaveBeenCalled()
    })

    it('should handle abort event and increment aborted requests', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      let abortHandler: () => void = () => {}
      mockReq.once.mockImplementation((event, handler) => {
        if (event === 'aborted') abortHandler = handler
      })
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      await middleware(mockCtx as any, mockNext)

      // Act
      abortHandler()

      // Assert
      expect(mockAbortedRequests.inc).toHaveBeenCalledWith(
        {
          [RequestsMetricLabels.REQUEST_HANDLER]: 'test-handler-label',
        },
        1
      )
    })

    it('should set responseClosed flag when response closes before next finishes', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      let closeHandler: () => void = () => {}
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') closeHandler = handler
      })

      await middleware(mockCtx as any, mockNext)

      // Act
      closeHandler()

      // Assert - onResFinished should have been called synchronously
      expect(mockConcurrentRequests.dec).toHaveBeenCalled()
      expect(mockRequestTimings.observe).toHaveBeenCalled()
    })

    it('should use onStreamFinished when response is not immediately closed', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      let closeHandler: () => void = () => {}
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') closeHandler = handler
        // Don't call handler, so responseClosed stays false
      })
      const mockStreamFinished = jest.fn((res, callback) => callback())
      ;(stream.finished as jest.Mock).mockImplementation(mockStreamFinished)

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockStreamFinished).toHaveBeenCalledWith(mockRes, expect.any(Function))
    })

    it('should handle next function throwing error', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      const testError = new Error('test error')
      mockNext.mockRejectedValueOnce(testError)
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act & Assert
      await expect(middleware(mockCtx as any, mockNext)).rejects.toThrow('test error')
    })

    it('should still record metrics even if next function throws', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      const testError = new Error('test error')
      mockNext.mockRejectedValueOnce(testError)
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      try {
        await middleware(mockCtx as any, mockNext)
      } catch (e) {
        // Expected
      }

      // Assert - metrics should still be recorded in finally block
      expect(mockTotalRequests.inc).toHaveBeenCalled()
      expect(mockRequestTimings.observe).toHaveBeenCalled()
      expect(mockConcurrentRequests.dec).toHaveBeenCalled()
    })

    it('should handle different status codes', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(mockCtx.response as any).status = 404
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockTotalRequests.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          [RequestsMetricLabels.STATUS_CODE]: 404,
        }),
        1
      )
    })

    it('should handle different request handler names', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(mockCtx.requestHandlerName as any) = 'anotherHandler'
      ;(requestHandlerLabel as jest.Mock).mockReturnValue('another-handler-label')
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(requestHandlerLabel).toHaveBeenCalledWith('anotherHandler')
      expect(mockTotalRequests.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          [RequestsMetricLabels.REQUEST_HANDLER]: 'another-handler-label',
        }),
        1
      )
    })

    it('should handle large response sizes', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      const largeSize = 10485760 // 10MB
      ;(mockCtx.response as any).length = largeSize
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockResponseSizes.observe).toHaveBeenCalledWith(
        expect.any(Object),
        largeSize
      )
    })

    it('should convert hrtime to milliseconds correctly', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      const mockHrtime = [0, 123456789]
      ;(process.hrtime as jest.Mock) = jest.fn()
        .mockReturnValueOnce(mockHrtime)
        .mockReturnValueOnce(mockHrtime)
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(hrToMillisFloat).toHaveBeenCalledWith(mockHrtime)
    })

    it('should ensure concurrent requests counter stays in sync', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      const incCall = mockConcurrentRequests.inc.mock.calls[0]
      const decCall = mockConcurrentRequests.dec.mock.calls[0]
      expect(incCall[0]).toBe(1)
      expect(decCall[0]).toBe(1)
    })

    it('should handle multiple middleware instances independently', async () => {
      // Arrange
      const middleware1 = addRequestMetricsMiddleware()
      const middleware2 = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware1(mockCtx as any, mockNext)
      jest.clearAllMocks()
      await middleware2(mockCtx as any, mockNext)

      // Assert
      expect(createConcurrentRequestsInstrument).toHaveBeenCalledTimes(2)
      expect(createRequestsTimingsInstrument).toHaveBeenCalledTimes(2)
    })

    it('should handle status code 500 errors', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(mockCtx.response as any).status = 500
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockTotalRequests.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          [RequestsMetricLabels.STATUS_CODE]: 500,
        }),
        1
      )
    })

    it('should handle response with undefined length', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(mockCtx.response as any).length = undefined
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockResponseSizes.observe).not.toHaveBeenCalled()
    })

    it('should handle response with null length', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(mockCtx.response as any).length = null
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
      })

      // Act
      await middleware(mockCtx as any, mockNext)

      // Assert
      expect(mockResponseSizes.observe).not.toHaveBeenCalled()
    })
  })
})
