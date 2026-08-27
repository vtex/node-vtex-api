import { finished as onStreamFinished } from 'stream'
import { addRequestMetricsMiddleware } from './requestMetricsMiddleware'
import { hrToMillisFloat } from '../../utils'
import {
  createConcurrentRequestsInstrument,
  createRequestsResponseSizesInstrument,
  createRequestsTimingsInstrument,
  createTotalAbortedRequestsInstrument,
  createTotalRequestsInstrument,
  RequestsMetricLabels,
} from '../tracing/metrics/instruments'
import { requestHandlerLabel } from './requestHandlerLabel'
import { ServiceContext } from '../worker/runtime/typings'

jest.mock('stream')
jest.mock('../../utils')
jest.mock('../tracing/metrics/instruments')
jest.mock('./requestHandlerLabel')

describe('addRequestMetricsMiddleware', () => {
  let mockConcurrentRequests: any
  let mockRequestTimings: any
  let mockTotalRequests: any
  let mockResponseSizes: any
  let mockAbortedRequests: any
  let mockContext: Partial<ServiceContext>
  let mockReq: any
  let mockRes: any
  let mockNext: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock instruments
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

    // Setup mock stream/request/response
    mockReq = {
      once: jest.fn(),
    }
    mockRes = {
      once: jest.fn(),
    }

    // Setup mock context
    mockContext = {
      req: mockReq,
      res: mockRes,
      requestHandlerName: 'testHandler',
      response: {
        length: 100,
        status: 200,
      },
    }

    mockNext = jest.fn().mockResolvedValue(undefined)

    // Setup instrument creation mocks
    ;(createConcurrentRequestsInstrument as jest.Mock).mockReturnValue(mockConcurrentRequests)
    ;(createRequestsTimingsInstrument as jest.Mock).mockReturnValue(mockRequestTimings)
    ;(createTotalRequestsInstrument as jest.Mock).mockReturnValue(mockTotalRequests)
    ;(createRequestsResponseSizesInstrument as jest.Mock).mockReturnValue(mockResponseSizes)
    ;(createTotalAbortedRequestsInstrument as jest.Mock).mockReturnValue(mockAbortedRequests)
    ;(requestHandlerLabel as jest.Mock).mockReturnValue('labeledHandler')
    ;(hrToMillisFloat as jest.Mock).mockReturnValue(42.5)
  })

  describe('initialization', () => {
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

    it('should return a middleware function', () => {
      // Arrange & Act
      const middleware = addRequestMetricsMiddleware()

      // Assert
      expect(typeof middleware).toBe('function')
      expect(middleware.length).toBe(2) // ctx and next parameters
    })
  })

  describe('middleware execution - happy path', () => {
    it('should increment concurrent requests on start', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockConcurrentRequests.inc).toHaveBeenCalledWith(1)
    })

    it('should call next middleware', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should record total requests with correct labels', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockTotalRequests.inc).toHaveBeenCalledWith(
        {
          [RequestsMetricLabels.REQUEST_HANDLER]: 'labeledHandler',
          [RequestsMetricLabels.STATUS_CODE]: 200,
        },
        1
      )
    })

    it('should observe response sizes when response has length', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockResponseSizes.observe).toHaveBeenCalledWith(
        { [RequestsMetricLabels.REQUEST_HANDLER]: 'labeledHandler' },
        100
      )
    })

    it('should not observe response sizes when response has no length', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockContext.response = { length: 0, status: 204 }
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockResponseSizes.observe).not.toHaveBeenCalled()
    })

    it('should decrement concurrent requests after response finishes', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockConcurrentRequests.dec).toHaveBeenCalledWith(1)
    })

    it('should record request timings after response finishes', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockRequestTimings.observe).toHaveBeenCalledWith(
        { [RequestsMetricLabels.REQUEST_HANDLER]: 'labeledHandler' },
        42.5
      )
    })
  })

  describe('response close handling', () => {
    it('should use onStreamFinished when response is not already closed', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event) => {
        // close event handler is NOT called, simulating response not closed yet
        return mockRes
      })
      const finishCallback = jest.fn()
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => {
        finishCallback.mockImplementation(callback)
      })

      // Act
      await middleware(mockContext as ServiceContext, mockNext)
      // Simulate stream finishing
      finishCallback()

      // Assert
      expect(onStreamFinished).toHaveBeenCalledWith(mockRes, expect.any(Function))
      expect(mockConcurrentRequests.dec).toHaveBeenCalled()
    })

    it('should call onResFinished immediately when response is already closed', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      let closeHandler: (() => void) | null = null
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') {
          closeHandler = handler
          handler() // Close event happens immediately
        }
        return mockRes
      })

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(onStreamFinished).not.toHaveBeenCalled()
      expect(mockConcurrentRequests.dec).toHaveBeenCalled()
      expect(mockRequestTimings.observe).toHaveBeenCalled()
    })
  })

  describe('aborted request handling', () => {
    it('should register abort event listener on request', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockReq.once).toHaveBeenCalledWith('aborted', expect.any(Function))
    })

    it('should increment aborted requests counter when request is aborted', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      let abortHandler: (() => void) | null = null
      mockReq.once.mockImplementation((event, handler) => {
        if (event === 'aborted') {
          abortHandler = handler
        }
      })
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)
      // Simulate abort
      abortHandler?.()

      // Assert
      expect(mockAbortedRequests.inc).toHaveBeenCalledWith(
        { [RequestsMetricLabels.REQUEST_HANDLER]: 'labeledHandler' },
        1
      )
    })
  })

  describe('error handling', () => {
    it('should record metrics even when next() throws an error', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      const testError = new Error('Test error')
      mockNext.mockRejectedValue(testError)
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act & Assert
      await expect(middleware(mockContext as ServiceContext, mockNext)).rejects.toThrow(testError)
      expect(mockTotalRequests.inc).toHaveBeenCalled()
      expect(mockConcurrentRequests.dec).toHaveBeenCalled()
    })

    it('should decrement concurrent requests even when next() throws', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockNext.mockRejectedValue(new Error('Test error'))
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      try {
        await middleware(mockContext as ServiceContext, mockNext)
      } catch (e) {
        // Expected
      }

      // Assert
      expect(mockConcurrentRequests.dec).toHaveBeenCalledWith(1)
    })
  })

  describe('edge cases', () => {
    it('should handle different HTTP status codes', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockContext.response = { length: 50, status: 404 }
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockTotalRequests.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          [RequestsMetricLabels.STATUS_CODE]: 404,
        }),
        1
      )
    })

    it('should handle large response sizes', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      const largeSize = 1024 * 1024 * 100 // 100MB
      mockContext.response = { length: largeSize, status: 200 }
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(mockResponseSizes.observe).toHaveBeenCalledWith(
        expect.any(Object),
        largeSize
      )
    })

    it('should handle different request handler names', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockContext.requestHandlerName = 'customHandler'
      ;(requestHandlerLabel as jest.Mock).mockReturnValue('customLabeledHandler')
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(requestHandlerLabel).toHaveBeenCalledWith('customHandler')
      expect(mockTotalRequests.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          [RequestsMetricLabels.REQUEST_HANDLER]: 'customLabeledHandler',
        }),
        1
      )
    })

    it('should use hrToMillisFloat to convert hrtime to milliseconds', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      expect(hrToMillisFloat).toHaveBeenCalled()
      expect(mockRequestTimings.observe).toHaveBeenCalledWith(
        expect.any(Object),
        42.5
      )
    })
  })

  describe('metric label consistency', () => {
    it('should use the same handler label for all metrics', async () => {
      // Arrange
      const middleware = addRequestMetricsMiddleware()
      ;(requestHandlerLabel as jest.Mock).mockReturnValue('consistentLabel')
      mockRes.once.mockImplementation((event, handler) => {
        if (event === 'close') handler()
        return mockRes
      })
      ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => callback())

      // Act
      await middleware(mockContext as ServiceContext, mockNext)

      // Assert
      const expectedLabel = { [RequestsMetricLabels.REQUEST_HANDLER]: 'consistentLabel' }
      expect(mockResponseSizes.observe).toHaveBeenCalledWith(expectedLabel, expect.any(Number))
      expect(mockRequestTimings.observe).toHaveBeenCalledWith(expectedLabel, expect.any(Number))
    })
  })

  describe('instrument isolation', () => {
    it('should create separate instrument instances for each middleware', () => {
      // Arrange & Act
      const middleware1 = addRequestMetricsMiddleware()
      const middleware2 = addRequestMetricsMiddleware()

      // Assert
      expect(createConcurrentRequestsInstrument).toHaveBeenCalledTimes(2)
      expect(createRequestsTimingsInstrument).toHaveBeenCalledTimes(2)
      expect(middleware1).not.toBe(middleware2)
    })
  })
})
