// Mock @vtex/diagnostics-nodejs before any imports
jest.mock('@vtex/diagnostics-nodejs', () => ({
  Types: {},
  getMetricClient: jest.fn(),
  getLogger: jest.fn(),
}))

jest.mock('../../../../../service/metrics/client', () => ({
  getMetricClient: jest.fn(),
}))

import { DiagnosticsMetrics } from '../../../../../metrics/DiagnosticsMetrics'
import { timings } from './timings'

describe('timings middleware', () => {
  let mockDiagnosticsMetrics: jest.Mocked<DiagnosticsMetrics>
  let mockNext: jest.Mock
  let mockCtx: any
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    // Mock DiagnosticsMetrics with runWithBaseAttributes that executes the function
    mockDiagnosticsMetrics = {
      recordLatency: jest.fn(),
      incrementCounter: jest.fn(),
      setGauge: jest.fn(),
      runWithBaseAttributes: jest.fn((baseAttributes, fn) => fn()),
    } as any

    // Set up global
    global.diagnosticsMetrics = mockDiagnosticsMetrics

    // Mock global.metrics for legacy support
    ;(global as any).metrics = {
      batch: jest.fn(),
    }

    // Mock next function
    mockNext = jest.fn().mockResolvedValue(undefined)

    // Mock console.log to avoid test output noise
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

    // Mock context
    mockCtx = {
      status: 200,
      method: 'GET',
      path: '/test',
      vtex: {
        account: 'testaccount',
        workspace: 'master',
        production: true,
        route: {
          id: 'test-route',
          type: 'public',
        },
      },
      timings: {
        total: [1, 500000000], // 1.5 seconds
      },
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
    consoleLogSpy.mockRestore()
    delete (global as any).diagnosticsMetrics
    delete (global as any).metrics
  })

  describe('successful requests', () => {
    it('should record metrics for successful request', async () => {
      await timings(mockCtx, mockNext)

      // Verify runWithBaseAttributes is called with base attributes
      expect(mockDiagnosticsMetrics.runWithBaseAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'vtex.account.name': 'testaccount',
          component: 'http-handler',
          route_id: 'test-route',
          route_type: 'public',
        }),
        expect.any(Function)
      )

      // Diagnostics metrics - now only receive completion-specific attributes
      // Base attributes (account, route_id, etc.) are merged internally by DiagnosticsMetrics
      expect(mockDiagnosticsMetrics.recordLatency).toHaveBeenCalledWith(
        [1, 500000000],
        expect.objectContaining({
          status_code: 200,
          status: 'success',
        })
      )

      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_handler_requests_total',
        1,
        expect.objectContaining({
          status_code: 200,
          status: 'success',
        })
      )
    })

    it('should log timing and billing information', async () => {
      await timings(mockCtx, mockNext)

      // Check console.log was called twice (timing log + billing log)
      expect(consoleLogSpy).toHaveBeenCalledTimes(2)

      // Verify billing info structure
      const billingCall = consoleLogSpy.mock.calls[1][0]
      const billingInfo = JSON.parse(billingCall)

      expect(billingInfo).toMatchObject({
        __VTEX_IO_BILLING: 'true',
        account: 'testaccount',
        handler: 'test-route',
        production: true,
        routeType: 'public_route',
        type: 'process-time',
        workspace: 'master',
      })
      expect(billingInfo.value).toBeGreaterThan(0) // millis
    })

    it('should maintain legacy metrics compatibility', async () => {
      await timings(mockCtx, mockNext)

      // Verify legacy metrics.batch was called
      expect((global as any).metrics.batch).toHaveBeenCalledWith(
        'http-handler-test-route',
        [1, 500000000],
        { success: 1 }
      )
    })
  })

  describe('error responses', () => {
    it('should record metrics for 4xx errors', async () => {
      mockCtx.status = 404

      await timings(mockCtx, mockNext)

      const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
      expect(latencyCall[1]).toMatchObject({
        status_code: 404,
        status: '4xx',
      })

      // Counter with status as attribute (base attributes merged internally)
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_handler_requests_total',
        1,
        expect.objectContaining({
          status_code: 404,
          status: '4xx',
        })
      )
    })

    it('should record metrics for 5xx errors', async () => {
      mockCtx.status = 500

      await timings(mockCtx, mockNext)

      expect(mockDiagnosticsMetrics.recordLatency).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          status_code: 500,
          status: 'error',
        })
      )

      // Verify legacy only batches successful responses (no hrtime for errors)
      expect((global as any).metrics.batch).toHaveBeenCalledWith(
        'http-handler-test-route',
        undefined,
        { error: 1 }
      )
    })
  })

  describe('route types', () => {
    it('should correctly identify private routes in billing info', async () => {
      mockCtx.vtex.route.type = 'private'

      await timings(mockCtx, mockNext)

      const billingCall = consoleLogSpy.mock.calls[1][0]
      const billingInfo = JSON.parse(billingCall)

      expect(billingInfo.routeType).toBe('private_route')
    })
  })

  describe('graceful degradation', () => {
    it('should work without global.diagnosticsMetrics', async () => {
      delete (global as any).diagnosticsMetrics

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await timings(mockCtx, mockNext)

      // Legacy metrics still work
      expect((global as any).metrics.batch).toHaveBeenCalled()

      // Warning logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'DiagnosticsMetrics not available. HTTP handler metrics not reported.'
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('different status codes', () => {
    const testCases = [
      { status: 200, expected: 'success' },
      { status: 201, expected: 'success' },
      { status: 204, expected: 'success' },
      { status: 301, expected: '3xx' }, // statusLabel returns range-based labels
      { status: 302, expected: '3xx' },
      { status: 400, expected: '4xx' },
      { status: 401, expected: '4xx' },
      { status: 403, expected: '4xx' },
      { status: 404, expected: '4xx' },
      { status: 500, expected: 'error' },
      { status: 502, expected: 'error' },
      { status: 503, expected: 'error' },
    ]

    testCases.forEach(({ status, expected }) => {
      it(`should categorize status ${status} as ${expected}`, async () => {
        mockCtx.status = status

        await timings(mockCtx, mockNext)

        const latencyCall = mockDiagnosticsMetrics.recordLatency.mock.calls[0]
        expect(latencyCall[1]).toMatchObject({
          status: expected,
        })
      })
    })
  })

  describe('middleware execution', () => {
    it('should call next() before recording metrics', async () => {
      let nextCalled = false
      mockNext.mockImplementation(async () => {
        nextCalled = true
      })

      await timings(mockCtx, mockNext)

      expect(nextCalled).toBe(true)
      expect(mockNext).toHaveBeenCalledTimes(1)
    })
  })
})

