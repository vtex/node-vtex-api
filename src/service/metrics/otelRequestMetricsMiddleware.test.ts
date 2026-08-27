import { finished as onStreamFinished } from 'stream'
import { addOtelRequestMetricsMiddleware } from './otelRequestMetricsMiddleware'
import * as utils from '../../utils'
import * as metricsModule from './metrics'
import * as requestHandlerLabelModule from './requestHandlerLabel'
import { ServiceContext } from '../worker/runtime/typings'

jest.mock('stream')
jest.mock('../../utils')
jest.mock('./metrics')
jest.mock('./requestHandlerLabel')

const mockOnStreamFinished = onStreamFinished as jest.MockedFunction<typeof onStreamFinished>
const mockHrToMillisFloat = utils.hrToMillisFloat as jest.MockedFunction<typeof utils.hrToMillisFloat>
const mockGetOtelInstruments = metricsModule.getOtelInstruments as jest.MockedFunction<typeof metricsModule.getOtelInstruments>
const mockRequestHandlerLabel = requestHandlerLabelModule.requestHandlerLabel as jest.MockedFunction<typeof requestHandlerLabelModule.requestHandlerLabel>

describe('addOtelRequestMetricsMiddleware', () => {
  let mockConcurrentRequests: any
  let mockAbortedRequests: any
  let mockResponseSizes: any
  let mockTotalRequests: any
  let mockRequestTimings: any
  let mockInstruments: any
  let mockCtx: Partial<ServiceContext>
  let mockReq: any
  let mockRes: any
  let mockResponse: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Setup mock instruments
    mockConcurrentRequests = {
      add: jest.fn(),
      subtract: jest.fn(),
    }
    mockAbortedRequests = {
      add: jest.fn(),
    }
    mockResponseSizes = {
      record: jest.fn(),
    }
    mockTotalRequests = {
      add: jest.fn(),
    }
    mockRequestTimings = {
      record: jest.fn(),
    }
    mockInstruments = {
      concurrentRequests: mockConcurrentRequests,
      abortedRequests: mockAbortedRequests,
      responseSizes: mockResponseSizes,
      totalRequests: mockTotalRequests,
      requestTimings: mockRequestTimings,
    }

    // Setup mock request/response
    mockReq = {
      once: jest.fn(),
    }
    mockRes = {
      once: jest.fn(),
    }
    mockResponse = {
      length: 1024,
      status: 200,
    }

    mockCtx = {
      requestHandlerName: 'testHandler',
      req: mockReq as any,
      res: mockRes as any,
      response: mockResponse as any,
      vtex: { account: 'test-account' },
    }

    mockGetOtelInstruments.mockResolvedValue(mockInstruments)
    mockHrToMillisFloat.mockReturnValue(100)
    mockRequestHandlerLabel.mockReturnValue('test-label')
    mockOnStreamFinished.mockImplementation((stream, callback) => {
      callback()
      return stream
    })

    jest.spyOn(process, 'hrtime').mockReturnValue([1, 0] as any)
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('middleware initialization', () => {
    it('should return a middleware function', () => {
      // Arrange & Act
      const middleware = addOtelRequestMetricsMiddleware()

      // Assert
      expect(typeof middleware).toBe('function')
    })
  })

  describe('middleware execution - happy path', () => {
    it('should increment concurrent requests and record metrics on successful request', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      let closeCallback: any
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          closeCallback = callback
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockConcurrentRequests.add).toHaveBeenCalledWith(1)
      expect(mockConcurrentRequests.subtract).toHaveBeenCalledWith(1)
      expect(mockTotalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'request_handler': 'test-label',
          'status_code': 200,
          'account_name': 'test-account',
        })
      )
    })

    it('should record response size metrics', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockResponseSizes.record).toHaveBeenCalledWith(
        1024,
        expect.objectContaining({
          'request_handler': 'test-label',
          'status_code': 200,
          'account_name': 'test-account',
        })
      )
    })

    it('should record request timings after response closes', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockRequestTimings.record).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          'request_handler': 'test-label',
          'status_code': 200,
          'account_name': 'test-account',
        })
      )
    })

    it('should call next() and wait for completion', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(next).toHaveBeenCalled()
    })
  })

  describe('middleware execution - instruments loading', () => {
    it('should attempt to load instruments on first request', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockGetOtelInstruments).toHaveBeenCalled()
    })

    it('should cache instruments for subsequent requests', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)
      jest.clearAllMocks()
      mockGetOtelInstruments.mockClear()

      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockGetOtelInstruments).not.toHaveBeenCalled()
    })

    it('should skip metrics collection if instruments not available', async () => {
      // Arrange
      mockGetOtelInstruments.mockResolvedValue(undefined)
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(next).toHaveBeenCalled()
      expect(mockConcurrentRequests.add).not.toHaveBeenCalled()
      expect(mockTotalRequests.add).not.toHaveBeenCalled()
    })
  })

  describe('instruments initialization timeout', () => {
    it('should timeout if instruments take too long to initialize', async () => {
      // Arrange
      mockGetOtelInstruments.mockImplementation(() => new Promise(() => {}))
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)

      // Act
      const promise = middleware(mockCtx as ServiceContext, next)
      jest.advanceTimersByTime(500)
      await promise

      // Assert
      expect(mockConcurrentRequests.add).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('OpenTelemetry instruments not ready')
      )
    })

    it('should handle timeout error gracefully', async () => {
      // Arrange
      mockGetOtelInstruments.mockImplementation(() => new Promise(() => {}))
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)

      // Act
      const promise = middleware(mockCtx as ServiceContext, next)
      jest.advanceTimersByTime(500)
      await promise

      // Assert
      expect(next).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle getOtelInstruments rejection with Error', async () => {
      // Arrange
      const testError = new Error('Instruments init failed')
      mockGetOtelInstruments.mockRejectedValue(testError)
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Instruments init failed')
      )
      expect(next).toHaveBeenCalled()
    })

    it('should handle getOtelInstruments rejection with non-Error object', async () => {
      // Arrange
      mockGetOtelInstruments.mockRejectedValue('String error')
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('String error')
      )
      expect(next).toHaveBeenCalled()
    })

    it('should continue even if next() throws', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const testError = new Error('Handler failed')
      const next = jest.fn().mockRejectedValue(testError)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act & Assert
      await expect(middleware(mockCtx as ServiceContext, next)).rejects.toThrow('Handler failed')
      expect(mockTotalRequests.add).toHaveBeenCalled()
    })
  })

  describe('abort handling', () => {
    it('should record aborted requests when request is aborted', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      let abortCallback: any
      mockReq.once.mockImplementation((event: string, callback: any) => {
        if (event === 'aborted') {
          abortCallback = callback
        }
      })
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)
      abortCallback()

      // Assert
      expect(mockAbortedRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'request_handler': 'test-label',
        })
      )
    })
  })

  describe('response close handling', () => {
    it('should use onStreamFinished when response not yet closed', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          // Do not call callback - response not yet closed
        }
      })
      let streamFinishedCallback: any
      mockOnStreamFinished.mockImplementation((stream, callback) => {
        streamFinishedCallback = callback
        return stream
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockOnStreamFinished).toHaveBeenCalledWith(mockRes, expect.any(Function))
    })

    it('should call onResFinished immediately when response already closed', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback() // Response closes immediately
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockOnStreamFinished).not.toHaveBeenCalled()
      expect(mockRequestTimings.record).toHaveBeenCalled()
    })
  })

  describe('response metrics with edge cases', () => {
    it('should handle missing response length', async () => {
      // Arrange
      mockResponse.length = undefined
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockResponseSizes.record).not.toHaveBeenCalled()
      expect(mockTotalRequests.add).toHaveBeenCalled()
    })

    it('should handle zero response length', async () => {
      // Arrange
      mockResponse.length = 0
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockResponseSizes.record).not.toHaveBeenCalled()
    })

    it('should handle missing vtex account', async () => {
      // Arrange
      mockCtx.vtex = undefined
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockTotalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'account_name': 'unknown',
        })
      )
    })

    it('should handle missing vtex.account property', async () => {
      // Arrange
      mockCtx.vtex = { account: undefined } as any
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockTotalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'account_name': 'unknown',
        })
      )
    })
  })

  describe('request handler labeling', () => {
    it('should call requestHandlerLabel with handler name', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockRequestHandlerLabel).toHaveBeenCalledWith('testHandler')
    })
  })

  describe('concurrent requests tracking', () => {
    it('should increment and then decrement concurrent requests', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      const callOrder: string[] = []
      mockConcurrentRequests.add.mockImplementation(() => {
        callOrder.push('add')
      })
      mockConcurrentRequests.subtract.mockImplementation(() => {
        callOrder.push('subtract')
      })
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(callOrder).toEqual(['add', 'subtract'])
    })
  })

  describe('multiple concurrent requests', () => {
    it('should handle multiple concurrent requests independently', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next1 = jest.fn().mockResolvedValue(undefined)
      const next2 = jest.fn().mockResolvedValue(undefined)
      let closeCallback1: any
      let closeCallback2: any
      let callCount = 0

      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callCount++
          if (callCount === 1) {
            closeCallback1 = callback
          } else {
            closeCallback2 = callback
          }
        }
      })

      // Act
      const ctx2 = { ...mockCtx, requestHandlerName: 'handler2' } as ServiceContext
      const promise1 = middleware(mockCtx as ServiceContext, next1)
      const promise2 = middleware(ctx2, next2)

      await Promise.all([promise1, promise2])
      closeCallback1?.()
      closeCallback2?.()

      // Assert
      expect(mockConcurrentRequests.add).toHaveBeenCalledTimes(2)
      expect(mockConcurrentRequests.subtract).toHaveBeenCalledTimes(2)
    })
  })

  describe('hrtime and timing calculations', () => {
    it('should use hrToMillisFloat to convert hrtime delta', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockHrToMillisFloat).toHaveBeenCalled()
      expect(mockRequestTimings.record).toHaveBeenCalledWith(100, expect.any(Object))
    })
  })

  describe('status codes in metrics', () => {
    it('should record different status codes', async () => {
      // Arrange
      mockResponse.status = 404
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockResponseSizes.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          'status_code': 404,
        })
      )
      expect(mockTotalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'status_code': 404,
        })
      )
    })

    it('should record 500 error status code', async () => {
      // Arrange
      mockResponse.status = 500
      const middleware = addOtelRequestMetricsMiddleware()
      const next = jest.fn().mockResolvedValue(undefined)
      mockRes.once.mockImplementation((event: string, callback: any) => {
        if (event === 'close') {
          callback()
        }
      })

      // Act
      await middleware(mockCtx as ServiceContext, next)

      // Assert
      expect(mockRequestTimings.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          'status_code': 500,
        })
      )
    })
  })
})
