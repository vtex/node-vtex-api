import { EventEmitter } from 'events'
import { DiagnosticsMetrics } from '../../../../../metrics/DiagnosticsMetrics'
import { incomingRequestStats, trackIncomingRequestStats } from './requestStats'

describe('requestStats', () => {
  let mockDiagnosticsMetrics: jest.Mocked<DiagnosticsMetrics>

  beforeEach(() => {
    // Create mock DiagnosticsMetrics instance
    mockDiagnosticsMetrics = {
      setGauge: jest.fn(),
      incrementCounter: jest.fn(),
      recordLatency: jest.fn(),
    } as any

    // Set global.diagnosticsMetrics for the tests
    global.diagnosticsMetrics = mockDiagnosticsMetrics

    // Clear stats before each test
    incomingRequestStats.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete (global as any).diagnosticsMetrics
  })

  describe('IncomingRequestStats', () => {
    it('should track total requests', () => {
      incomingRequestStats.total++
      incomingRequestStats.total++

      const stats = incomingRequestStats.get()
      expect(stats.total).toBe(2)
    })

    it('should track aborted requests', () => {
      incomingRequestStats.aborted++
      incomingRequestStats.aborted++

      const stats = incomingRequestStats.get()
      expect(stats.aborted).toBe(2)
    })

    it('should track closed requests', () => {
      incomingRequestStats.closed++

      const stats = incomingRequestStats.get()
      expect(stats.closed).toBe(1)
    })

    it('should clear all stats', () => {
      incomingRequestStats.total = 5
      incomingRequestStats.aborted = 3
      incomingRequestStats.closed = 2

      incomingRequestStats.clear()

      const stats = incomingRequestStats.get()
      expect(stats).toEqual({
        total: 0,
        aborted: 0,
        closed: 0,
      })
    })
  })

  describe('trackIncomingRequestStats', () => {
    let mockCtx: any
    let mockRequest: EventEmitter
    let mockNext: jest.Mock

    beforeEach(() => {
      mockRequest = new EventEmitter()
      mockNext = jest.fn().mockResolvedValue(undefined)
      mockCtx = {
        req: mockRequest,
        vtex: {
          cancellation: {
            cancelable: true,
            source: { cancel: jest.fn() },
            cancelled: false,
          },
        },
      }
    })

    it('should increment total requests counter and report to diagnostics metrics', async () => {
      await trackIncomingRequestStats(mockCtx, mockNext)

      expect(incomingRequestStats.get().total).toBe(1)
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_server_requests_total',
        1,
        {}
      )
    })

    it('should call next middleware', async () => {
      await trackIncomingRequestStats(mockCtx, mockNext)

      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should increment closed counter when request closes and report to diagnostics', async () => {
      await trackIncomingRequestStats(mockCtx, mockNext)

      mockRequest.emit('close')

      expect(incomingRequestStats.get().closed).toBe(1)
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_server_requests_closed_total',
        1,
        {}
      )
    })

    it('should increment aborted counter when request aborts and report to diagnostics', async () => {
      await trackIncomingRequestStats(mockCtx, mockNext)

      mockRequest.emit('aborted')

      expect(incomingRequestStats.get().aborted).toBe(1)
      expect(mockDiagnosticsMetrics.incrementCounter).toHaveBeenCalledWith(
        'http_server_requests_aborted_total',
        1,
        {}
      )
    })

    it('should cancel request when aborted and cancellation is available', async () => {
      await trackIncomingRequestStats(mockCtx, mockNext)

      mockRequest.emit('aborted')

      expect(mockCtx.vtex.cancellation.source.cancel).toHaveBeenCalledWith('Request cancelled')
      expect(mockCtx.vtex.cancellation.cancelled).toBe(true)
    })

    it('should handle multiple events correctly', async () => {
      await trackIncomingRequestStats(mockCtx, mockNext)

      mockRequest.emit('close')
      mockRequest.emit('aborted')

      expect(incomingRequestStats.get().total).toBe(1)
      expect(incomingRequestStats.get().closed).toBe(1)
      expect(incomingRequestStats.get().aborted).toBe(1)
    })

    it('should work without global.diagnosticsMetrics', async () => {
      delete (global as any).diagnosticsMetrics

      // Should not throw
      await expect(trackIncomingRequestStats(mockCtx, mockNext)).resolves.not.toThrow()

      expect(incomingRequestStats.get().total).toBe(1)
    })

    it('should handle request events without diagnostics metrics', async () => {
      delete (global as any).diagnosticsMetrics

      await trackIncomingRequestStats(mockCtx, mockNext)

      // Should not throw when events are emitted
      expect(() => mockRequest.emit('close')).not.toThrow()
      expect(() => mockRequest.emit('aborted')).not.toThrow()

      expect(incomingRequestStats.get().closed).toBe(1)
      expect(incomingRequestStats.get().aborted).toBe(1)
    })
  })
})




