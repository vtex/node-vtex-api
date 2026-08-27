import { EventEmitter } from 'events'
import { finished as onStreamFinished } from 'stream'
import { addOtelRequestMetricsMiddleware } from './otelRequestMetricsMiddleware'
import * as metricsModule from './metrics'
import * as utilsModule from '../../utils'
import * as requestHandlerLabelModule from './requestHandlerLabel'

jest.mock('stream')
jest.mock('./metrics')
jest.mock('../../utils')
jest.mock('./requestHandlerLabel')

describe('addOtelRequestMetricsMiddleware', () => {
  let mockInstruments: any
  let mockCtx: any
  let mockNext: jest.Mock
  let mockReq: EventEmitter
  let mockRes: EventEmitter

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Mock instruments
    mockInstruments = {
      concurrentRequests: { add: jest.fn(), subtract: jest.fn() },
      abortedRequests: { add: jest.fn() },
      responseSizes: { record: jest.fn() },
      totalRequests: { add: jest.fn() },
      requestTimings: { record: jest.fn() },
    }

    // Mock context
    mockReq = new EventEmitter()
    mockRes = new EventEmitter()

    mockCtx = {
      requestHandlerName: 'testHandler',
      req: mockReq,
      res: mockRes,
      response: {
        length: 1024,
        status: 200,
      },
      vtex: {
        account: 'testAccount',
      },
    }

    mockNext = jest.fn().mockResolvedValue(undefined)

    // Mock utility functions
    ;(requestHandlerLabelModule.requestHandlerLabel as jest.Mock).mockReturnValue('test_handler')
    ;(utilsModule.hrToMillisFloat as jest.Mock).mockReturnValue(100.5)
    ;(onStreamFinished as jest.Mock).mockImplementation((stream, callback) => {
      // Simulate immediate callback
      process.nextTick(() => callback())
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('middleware initialization', () => {
    it('should return a middleware function', () => {
      // Arrange & Act
      const middleware = addOtelRequestMetricsMiddleware()

      // Assert
      expect(typeof middleware).toBe('function')
    })
  })

  describe('tryGetInstruments', () => {
    it('should successfully retrieve instruments on first call', async () => {
      // Arrange
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValueOnce(mockInstruments)
      const middleware = addOtelRequestMetricsMiddleware()

      // Act
      await middleware(mockCtx, mockNext)

      // Assert
      expect(metricsModule.getOtelInstruments).toHaveBeenCalled()
      expect(mockInstruments.concurrentRequests.add).toHaveBeenCalledWith(1)
    })

    it('should timeout if instruments initialization takes too long', async () => {
      // Arrange
      ;(metricsModule.getOtelInstruments as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      )
      const middleware = addOtelRequestMetricsMiddleware()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Act
      const middlewarePromise = middleware(mockCtx, mockNext)
      jest.advanceTimersByTime(600)
      await middlewarePromise

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('OpenTelemetry instruments not ready')
      )
      expect(mockNext).toHaveBeenCalled()
      expect(mockInstruments.concurrentRequests.add).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle error from getOtelInstruments', async () => {
      // Arrange
      ;(metricsModule.getOtelInstruments as jest.Mock).mockRejectedValueOnce(
        new Error('Instruments initialization failed')
      )
      const middleware = addOtelRequestMetricsMiddleware()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Act
      await middleware(mockCtx, mockNext)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Instruments initialization failed')
      )
      expect(mockNext).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle non-Error thrown from getOtelInstruments', async () => {
      // Arrange
      ;(metricsModule.getOtelInstruments as jest.Mock).mockRejectedValueOnce('string error')
      const middleware = addOtelRequestMetricsMiddleware()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Act
      await middleware(mockCtx, mockNext)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('string error'))
      expect(mockNext).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should cache instruments after first successful retrieval', async () => {
      // Arrange
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValueOnce(mockInstruments)
      const middleware = addOtelRequestMetricsMiddleware()

      // Act
      await middleware(mockCtx, mockNext)
      ;(metricsModule.getOtelInstruments as jest.Mock).mockClear()
      await middleware(mockCtx, mockNext)

      // Assert
      expect(metricsModule.getOtelInstruments).not.toHaveBeenCalled()
    })
  })

  describe('request metrics collection', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should increment concurrent requests on middleware invocation', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()

      // Act
      await middleware(mockCtx, mockNext)

      // Assert
      expect(mockInstruments.concurrentRequests.add).toHaveBeenCalledWith(1)
    })

    it('should decrement concurrent requests after response finishes', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.concurrentRequests.subtract).toHaveBeenCalledWith(1)
    })

    it('should record response size with correct labels', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.responseSizes.record).toHaveBeenCalledWith(
        1024,
        expect.objectContaining({
          'request.handler': 'test_handler',
          'http.status_code': 200,
          'account.name': 'testAccount',
        })
      )
    })

    it('should not record response size when responseLength is 0', async () => {
      // Arrange
      mockCtx.response.length = 0
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.responseSizes.record).not.toHaveBeenCalled()
    })

    it('should not record response size when responseLength is undefined', async () => {
      // Arrange
      mockCtx.response.length = undefined
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.responseSizes.record).not.toHaveBeenCalled()
    })

    it('should record total requests with correct labels', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.totalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'request.handler': 'test_handler',
          'http.status_code': 200,
          'account.name': 'testAccount',
        })
      )
    })

    it('should use "unknown" for account name when vtex is undefined', async () => {
      // Arrange
      mockCtx.vtex = undefined
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.totalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'account.name': 'unknown',
        })
      )
    })

    it('should use "unknown" for account name when account is undefined', async () => {
      // Arrange
      mockCtx.vtex = { account: undefined }
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.totalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'account.name': 'unknown',
        })
      )
    })
  })

  describe('request timing metrics', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should record request timing when response is already closed', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close') // Emit close before middleware invocation

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.requestTimings.record).toHaveBeenCalledWith(
        100.5,
        expect.objectContaining({
          'request.handler': 'test_handler',
          'http.status_code': 200,
          'account.name': 'testAccount',
        })
      )
    })

    it('should record request timing using onStreamFinished when response is not closed', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      // Don't emit close before middleware

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(onStreamFinished).toHaveBeenCalledWith(mockRes, expect.any(Function))
      expect(mockInstruments.requestTimings.record).toHaveBeenCalledWith(
        100.5,
        expect.any(Object)
      )
    })

    it('should calculate timing using hrToMillisFloat', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')
      ;(utilsModule.hrToMillisFloat as jest.Mock).mockReturnValueOnce(250.75)

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.requestTimings.record).toHaveBeenCalledWith(
        250.75,
        expect.any(Object)
      )
    })
  })

  describe('aborted request handling', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should record aborted request when req emits abort event', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      const middlewarePromise = middleware(mockCtx, mockNext)

      // Act
      mockReq.emit('aborted')
      await middlewarePromise

      // Assert
      expect(mockInstruments.abortedRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'request.handler': 'test_handler',
        })
      )
    })

    it('should not record aborted request if instruments become undefined', async () => {
      // Arrange
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValueOnce(mockInstruments)
      const middleware = addOtelRequestMetricsMiddleware()
      const middlewarePromise = middleware(mockCtx, mockNext)

      // Clear instruments after middleware initialization
      const instrumentsAtInitialization = mockInstruments
      mockInstruments = undefined

      // Act
      mockReq.emit('aborted')
      await middlewarePromise

      // Assert
      expect(instrumentsAtInitialization.abortedRequests.add).not.toHaveBeenCalled()
    })
  })

  describe('error handling in next()', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should still record metrics even if next() throws', async () => {
      // Arrange
      mockNext.mockRejectedValueOnce(new Error('Handler error'))
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act & Assert
      await expect(middleware(mockCtx, mockNext)).rejects.toThrow('Handler error')
      expect(mockInstruments.totalRequests.add).toHaveBeenCalled()
      expect(mockInstruments.requestTimings.record).toHaveBeenCalled()
    })
  })

  describe('no instruments scenario', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValueOnce(undefined)
    })

    it('should skip all metrics if instruments are not available', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()

      // Act
      await middleware(mockCtx, mockNext)

      // Assert
      expect(mockNext).toHaveBeenCalled()
      expect(mockInstruments.concurrentRequests.add).not.toHaveBeenCalled()
      expect(mockInstruments.totalRequests.add).not.toHaveBeenCalled()
      expect(mockInstruments.requestTimings.record).not.toHaveBeenCalled()
    })
  })

  describe('response close event timing', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should handle response close before next() completes', async () => {
      // Arrange
      const middleware = addOtelRequestMetricsMiddleware()
      let nextCompleted = false
      mockNext.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => {
            nextCompleted = true
            resolve()
          }, 100)
        })
      )

      // Act
      const middlewarePromise = middleware(mockCtx, mockNext)
      jest.advanceTimersByTime(50)
      mockRes.emit('close')
      jest.advanceTimersByTime(100)
      await middlewarePromise

      // Assert
      expect(nextCompleted).toBe(true)
      expect(mockInstruments.concurrentRequests.subtract).toHaveBeenCalledWith(1)
    })
  })

  describe('request handler label conversion', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should call requestHandlerLabel with correct handler name', async () => {
      // Arrange
      mockCtx.requestHandlerName = 'customHandlerName'
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(requestHandlerLabelModule.requestHandlerLabel).toHaveBeenCalledWith('customHandlerName')
    })
  })

  describe('concurrent middleware instances', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should maintain separate instrument state for each middleware instance', async () => {
      // Arrange
      const middleware1 = addOtelRequestMetricsMiddleware()
      const middleware2 = addOtelRequestMetricsMiddleware()
      ;(metricsModule.getOtelInstruments as jest.Mock).mockClear()

      // Act
      await middleware1(mockCtx, mockNext)
      await middleware2(mockCtx, mockNext)

      // Assert
      // Each middleware instance should call getOtelInstruments once
      expect(metricsModule.getOtelInstruments).toHaveBeenCalledTimes(2)
    })
  })

  describe('response status codes', () => {
    beforeEach(() => {
      ;(metricsModule.getOtelInstruments as jest.Mock).mockResolvedValue(mockInstruments)
    })

    it('should record correct metrics for 404 status', async () => {
      // Arrange
      mockCtx.response.status = 404
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.totalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'http.status_code': 404,
        })
      )
    })

    it('should record correct metrics for 500 status', async () => {
      // Arrange
      mockCtx.response.status = 500
      const middleware = addOtelRequestMetricsMiddleware()
      mockRes.emit('close')

      // Act
      await middleware(mockCtx, mockNext)
      jest.runAllTimers()

      // Assert
      expect(mockInstruments.totalRequests.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          'http.status_code': 500,
        })
      )
    })
  })
})
