// Mock @vtex/diagnostics-nodejs before any imports
jest.mock('@vtex/diagnostics-nodejs', () => ({
  Types: {},
  getMetricClient: jest.fn(),
  getLogger: jest.fn(),
}))

jest.mock('../../service/metrics/client', () => ({
  getMetricClient: jest.fn(),
}))

jest.mock('../../errors/RequestCancelledError', () => ({
  RequestCancelledError: class RequestCancelledError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'RequestCancelledError'
    }
  },
}))

import { DiagnosticsMetrics } from '../../metrics/DiagnosticsMetrics'
import { MetricsAccumulator } from '../../metrics/MetricsAccumulator'
import { metricsMiddleware } from './metrics'
import { MiddlewareContext } from '../typings'

describe('metricsMiddleware', () => {
  let mockMetrics: jest.Mocked<MetricsAccumulator>
  let mockDiagnosticsMetrics: jest.Mocked<DiagnosticsMetrics>
  let mockNext: jest.Mock
  let mockCtx: MiddlewareContext

  beforeEach(() => {
    // Mock MetricsAccumulator
    mockMetrics = {
      batch: jest.fn(),
    } as any

    // Mock DiagnosticsMetrics
    mockDiagnosticsMetrics = {
      recordLatency: jest.fn(),
      incrementCounter: jest.fn(),
      setGauge: jest.fn(),
    } as any

    // Set up global
    global.diagnosticsMetrics = mockDiagnosticsMetrics

    // Mock next function
    mockNext = jest.fn().mockResolvedValue(undefined)

    // Mock context
    mockCtx = {
      config: {
        metric: 'test-client',
        retryCount: 0,
      },
      response: {
        status: 200,
      },
      cacheHit: undefined,
      inflightHit: undefined,
      memoizedHit: undefined,
    } as any
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete (global as any).diagnosticsMetrics
  })

  describe('successful requests', () => {
    it('should record metrics for successful request with no cache', async () => {
      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      // Legacy metrics
      const batchCall = mockMetrics.batch.mock.calls[0]
      expect(batchCall[0]).toBe('http-client-test-client')
      expect(Array.isArray(batchCall[1])).toBe(true) // hrtime tuple
      expect(batchCall[2]).toMatchObject({
        success: 1,
        'success-miss': 1,
      })

      // Diagnostics metrics
      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(Array.isArray(latencyCall[0])).toBe(true) // hrtime tuple
      expect(latencyCall[1]).toMatchObject({
        component: 'http-client',
        client_metric: 'test-client',
        status_code: 200,
        status: 'success',
        cache_state: 'miss',
      })

      // Main request counter with status as attribute
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_client_requests_total',
        1,
        expect.objectContaining({
          component: 'http-client',
          client_metric: 'test-client',
          status_code: 200,
          status: 'success',
        })
      )

      // Cache counter with cache_state as attribute
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_client_cache_total',
        1,
        expect.objectContaining({
          component: 'http-client',
          client_metric: 'test-client',
          status: 'success',
          cache_state: 'miss',
        })
      )
    })

    it('should record metrics with cache hit', async () => {
      mockCtx.cacheHit = { revalidated: 1 }

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        cache_state: 'hit',
      })

      // Should have cache counter with cache_state attribute
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_client_cache_total',
        1,
        expect.objectContaining({
          component: 'http-client',
          client_metric: 'test-client',
          cache_state: 'hit',
        })
      )
    })

    it('should record metrics with inflight hit', async () => {
      mockCtx.inflightHit = true

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        cache_state: 'inflight',
      })
    })

    it('should record metrics with memoized hit', async () => {
      mockCtx.memoizedHit = true

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        cache_state: 'memoized',
      })
    })

    it('should include retry count in attributes when retries occurred', async () => {
      mockCtx.config.retryCount = 2

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      // Histogram should not include retry_count (only in counter)
      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        status: 'success',
        cache_state: 'miss',
      })

      // Should have retry counter with retry_count attribute
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_client_requests_retried_total',
        1,
        expect.objectContaining({
          component: 'http-client',
          client_metric: 'test-client',
          status: 'success',
          status_code: 200,
          retry_count: 2, // Number, not string
        })
      )
    })
  })

  describe('error handling', () => {
    it('should record metrics for timeout errors', async () => {
      mockNext.mockRejectedValueOnce({
        response: {
          data: { code: 'ProxyTimeout' }, // TIMEOUT_CODE
        },
      })

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await expect(middleware(mockCtx, mockNext)).rejects.toMatchObject({
        response: expect.any(Object),
      })

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        status: 'timeout',
      })
    })

    it('should record metrics for aborted requests', async () => {
      mockNext.mockRejectedValueOnce({
        code: 'ECONNABORTED',
      })

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await expect(middleware(mockCtx, mockNext)).rejects.toMatchObject({
        code: 'ECONNABORTED',
      })

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        status: 'aborted',
      })
    })

    it('should record metrics for cancelled requests', async () => {
      mockNext.mockRejectedValueOnce({
        message: 'Request cancelled',
      })

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await expect(middleware(mockCtx, mockNext)).rejects.toThrow('Request cancelled')

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        status: 'cancelled',
      })
    })

    it('should record metrics for HTTP error responses', async () => {
      mockNext.mockRejectedValueOnce({
        response: {
          status: 500,
        },
      })

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await expect(middleware(mockCtx, mockNext)).rejects.toMatchObject({
        response: { status: 500 },
      })

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        status: 'error',
      })
    })

    it('should record metrics for generic errors', async () => {
      mockNext.mockRejectedValueOnce(new Error('Generic error'))

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await expect(middleware(mockCtx, mockNext)).rejects.toThrow('Generic error')

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        status: 'error',
      })
    })
  })

  describe('backward compatibility', () => {
    it('should maintain legacy metrics when config.metric is set', async () => {
      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      // Verify legacy metrics still called
      expect(mockMetrics.batch).toHaveBeenCalledTimes(1)
      const batchCall = mockMetrics.batch.mock.calls[0]
      expect(batchCall[0]).toBe('http-client-test-client')
      expect(Array.isArray(batchCall[1])).toBe(true)
      expect(batchCall[2]).toBeTruthy()
    })

    it('should not record metrics when config.metric is not set', async () => {
      mockCtx.config.metric = undefined

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      expect(mockMetrics.batch).not.toHaveBeenCalled()
      expect(mockDiagnosticsMetrics.recordLatency).not.toHaveBeenCalled()
      expect(mockDiagnosticsMetrics.incrementCounter).not.toHaveBeenCalled()
    })
  })

  describe('graceful degradation', () => {
    it('should work without global.diagnosticsMetrics', async () => {
      delete (global as any).diagnosticsMetrics

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const middleware = metricsMiddleware({ metrics: mockMetrics, name: 'test' })

      await middleware(mockCtx, mockNext)

      // Legacy metrics still work
      expect(mockMetrics.batch).toHaveBeenCalled()

      // Warning logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'DiagnosticsMetrics not available. HTTP client metrics not reported.'
      )

      consoleWarnSpy.mockRestore()
    })
  })
})

