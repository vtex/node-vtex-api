import { Types } from '@vtex/diagnostics-nodejs'
import { DiagnosticsMetrics } from './DiagnosticsMetrics'

// Mock only the external I/O boundary (getMetricClient)
jest.mock('../service/metrics/client', () => ({
  getMetricClient: jest.fn(),
}))

// Mock constants to control LINKED value
jest.mock('../constants', () => ({
  ...jest.requireActual('../constants'),
  LINKED: false, // Default to false, will override in specific tests
}))

import { getMetricClient } from '../service/metrics/client'

describe('DiagnosticsMetrics', () => {
  let diagnosticsMetrics: DiagnosticsMetrics
  let mockMetricsClient: Types.MetricClient
  let recordedHistogramCalls: Array<{ value: number; attributes?: any }>
  let recordedCounterCalls: Map<string, Array<{ value: number; attributes?: any }>>
  let recordedGaugeCalls: Map<string, Array<{ value: number; attributes?: any }>>

  beforeEach(() => {
    // Reset call tracking
    recordedHistogramCalls = []
    recordedCounterCalls = new Map()
    recordedGaugeCalls = new Map()

    // Create a mock client that tracks calls instead of using jest.fn()
    mockMetricsClient = {
      createHistogram: (name: string, options: any) => ({
        record: (value: number, attributes?: any) => {
          recordedHistogramCalls.push({ value, attributes })
        },
      }),
      createCounter: (name: string, options: any) => ({
        add: (value: number, attributes?: any) => {
          if (!recordedCounterCalls.has(name)) {
            recordedCounterCalls.set(name, [])
          }
          recordedCounterCalls.get(name)!.push({ value, attributes })
        },
      }),
      createGauge: (name: string, options: any) => ({
        set: (value: number, attributes?: any) => {
          if (!recordedGaugeCalls.has(name)) {
            recordedGaugeCalls.set(name, [])
          }
          recordedGaugeCalls.get(name)!.push({ value, attributes })
        },
      }),
    } as any

    // Mock only the external call
    ;(getMetricClient as jest.Mock).mockResolvedValue(mockMetricsClient)

    // Create real instance
    diagnosticsMetrics = new DiagnosticsMetrics()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize metrics client and create latency histogram in constructor', async () => {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(getMetricClient).toHaveBeenCalledTimes(1)
      
      // Verify histogram was created by recording a value
      diagnosticsMetrics.recordLatency(100)
      expect(recordedHistogramCalls).toHaveLength(1)
      expect(recordedHistogramCalls[0].value).toBe(100)
    })

    /**
     * @description
     * Verifies that DiagnosticsMetrics handles metric client initialization failures gracefully
     * without crashing the application.
     * 
     * Test Strategy:
     * 1. Configure getMetricClient() mock to reject before instance creation
     *   - This simulates diagnostics service being unavailable
     *   - Must be done BEFORE constructor runs since it immediately calls getMetricClient()
     *   
     * 2. Create DiagnosticsMetrics instance
     *   - Constructor calls initMetricClient() synchronously
     *   - initMetricClient() starts async initialization (returns immediately)
     *   - Async code races getMetricClient() vs timeout
     *   - getMetricClient() rejects due to our mock
     *   - catch block logs error and sets metricsClient = undefined
     * 
     * 3. Wait for async initialization to complete
     *   - Constructor returns immediately (can't await in constructor)
     *   - Need to wait for async promise to settle before checking results
     *   - 10ms is sufficient for promise rejection and catch block execution
     * 
     * 4. Verify graceful degradation
     *   - Instance was created successfully (no exception thrown)
     *   - Error was logged to console (operational visibility)
     *   - metricsClient remains undefined (all record methods will no-op)
     * */
    it('should handle initialization errors gracefully', async () => {
      
      // Mock the getMetricClient (which is a Jest mock) to return an error
      // Using mockRejectedValueOnce to configure the mock to reject with an error the next time it's called
      const error = new Error('Initialization failed')
      ;(getMetricClient as jest.Mock).mockRejectedValueOnce(error)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Create new instance that will fail initialization
      const failingMetrics = new DiagnosticsMetrics()
      
      // Wait for initialization attempt (async operation in constructor)
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify error was logged (provides operational visibility)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize metric client:', error)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('recordLatency', () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should record latency from hrtime tuple to single shared histogram', () => {
      const hrtimeDiff: [number, number] = [1, 500000000] // 1.5 seconds
      const attributes = { operation: 'api-call', status: '2xx' }

      diagnosticsMetrics.recordLatency(hrtimeDiff, attributes)

      expect(recordedHistogramCalls).toHaveLength(1)
      expect(recordedHistogramCalls[0]).toEqual({ value: 1500, attributes })
    })

    it('should record latency from milliseconds number to single shared histogram', () => {
      const milliseconds = 42.5
      const attributes = { operation: 'db-query', status: 'success' }

      diagnosticsMetrics.recordLatency(milliseconds, attributes)

      expect(recordedHistogramCalls).toHaveLength(1)
      expect(recordedHistogramCalls[0]).toEqual({ value: milliseconds, attributes })
    })

    it('should record latency without attributes', () => {
      const milliseconds = 100

      diagnosticsMetrics.recordLatency(milliseconds)

      expect(recordedHistogramCalls).toHaveLength(1)
      expect(recordedHistogramCalls[0]).toEqual({ value: milliseconds, attributes: undefined })
    })

    it('should use the same histogram for all latency measurements', () => {
      diagnosticsMetrics.recordLatency(10, { operation: 'op1' })
      diagnosticsMetrics.recordLatency(20, { operation: 'op2' })
      diagnosticsMetrics.recordLatency(30, { operation: 'op3' })

      // All recordings go to the same histogram
      expect(recordedHistogramCalls).toHaveLength(3)
      expect(recordedHistogramCalls[0].value).toBe(10)
      expect(recordedHistogramCalls[1].value).toBe(20)
      expect(recordedHistogramCalls[2].value).toBe(30)
    })

    it('should warn if not initialized', () => {
      const uninitializedMetrics = new DiagnosticsMetrics()
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Don't wait for initialization
      uninitializedMetrics.recordLatency(100)

      expect(consoleWarnSpy).toHaveBeenCalledWith('DiagnosticsMetrics not initialized. Call initialize() first.')
      consoleWarnSpy.mockRestore()
    })
  })

  describe('incrementCounter', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should increment counter with value and attributes', () => {
      const attributes = { method: 'GET', status: '2xx' }

      diagnosticsMetrics.incrementCounter('http_requests_total', 1, attributes)

      const calls = recordedCounterCalls.get('http_requests_total')
      expect(calls).toHaveLength(1)
      expect(calls![0]).toEqual({ value: 1, attributes })
    })

    it('should increment counter without attributes', () => {
      diagnosticsMetrics.incrementCounter('requests', 5)

      const calls = recordedCounterCalls.get('requests')
      expect(calls).toHaveLength(1)
      expect(calls![0]).toEqual({ value: 5, attributes: undefined })
    })

    it('should reuse existing counter for same metric name', () => {
      diagnosticsMetrics.incrementCounter('requests', 1)
      diagnosticsMetrics.incrementCounter('requests', 2)
      diagnosticsMetrics.incrementCounter('requests', 3)

      const calls = recordedCounterCalls.get('requests')
      expect(calls).toHaveLength(3)
      expect(calls![0].value).toBe(1)
      expect(calls![1].value).toBe(2)
      expect(calls![2].value).toBe(3)
    })

    it('should create separate counters for different metric names', () => {
      diagnosticsMetrics.incrementCounter('counter1', 1)
      diagnosticsMetrics.incrementCounter('counter2', 2)

      expect(recordedCounterCalls.get('counter1')).toHaveLength(1)
      expect(recordedCounterCalls.get('counter2')).toHaveLength(1)
      expect(recordedCounterCalls.get('counter1')![0].value).toBe(1)
      expect(recordedCounterCalls.get('counter2')![0].value).toBe(2)
    })

    it('should warn if not initialized', () => {
      const uninitializedMetrics = new DiagnosticsMetrics()
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      uninitializedMetrics.incrementCounter('test', 1)

      expect(consoleWarnSpy).toHaveBeenCalledWith('DiagnosticsMetrics not initialized. Call initialize() first.')
      consoleWarnSpy.mockRestore()
    })
  })

  describe('setGauge', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should set gauge with value and attributes', () => {
      const attributes = { cache: 'pages' }

      diagnosticsMetrics.setGauge('cache_items_current', 1024, attributes)

      const calls = recordedGaugeCalls.get('cache_items_current')
      expect(calls).toHaveLength(1)
      expect(calls![0]).toEqual({ value: 1024, attributes })
    })

    it('should set gauge without attributes', () => {
      diagnosticsMetrics.setGauge('memory_usage', 512)

      const calls = recordedGaugeCalls.get('memory_usage')
      expect(calls).toHaveLength(1)
      expect(calls![0]).toEqual({ value: 512, attributes: undefined })
    })

    it('should reuse existing gauge for same metric name', () => {
      diagnosticsMetrics.setGauge('gauge1', 10)
      diagnosticsMetrics.setGauge('gauge1', 20)
      diagnosticsMetrics.setGauge('gauge1', 30)

      const calls = recordedGaugeCalls.get('gauge1')
      expect(calls).toHaveLength(3)
      expect(calls![0].value).toBe(10)
      expect(calls![1].value).toBe(20)
      expect(calls![2].value).toBe(30)
    })

    it('should create separate gauges for different metric names', () => {
      diagnosticsMetrics.setGauge('gauge1', 100)
      diagnosticsMetrics.setGauge('gauge2', 200)

      expect(recordedGaugeCalls.get('gauge1')).toHaveLength(1)
      expect(recordedGaugeCalls.get('gauge2')).toHaveLength(1)
      expect(recordedGaugeCalls.get('gauge1')![0].value).toBe(100)
      expect(recordedGaugeCalls.get('gauge2')![0].value).toBe(200)
    })

    it('should warn if not initialized', () => {
      const uninitializedMetrics = new DiagnosticsMetrics()
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      uninitializedMetrics.setGauge('test', 100)

      expect(consoleWarnSpy).toHaveBeenCalledWith('DiagnosticsMetrics not initialized. Call initialize() first.')
      consoleWarnSpy.mockRestore()
    })
  })

  describe('Attribute Limiting', () => {
    beforeEach(() => {
      // Enable LINKED for these tests so warnings are triggered
      const constants = require('../constants')
      Object.defineProperty(constants, 'LINKED', {
        value: true,
        writable: true,
        configurable: true,
      })
    })

    afterEach(() => {
      // Reset LINKED back to false
      const constants = require('../constants')
      Object.defineProperty(constants, 'LINKED', {
        value: false,
        writable: true,
        configurable: true,
      })
    })

    it('should allow up to 7 attributes without warning', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const attributes = {
        attr1: 'value1',
        attr2: 'value2',
        attr3: 'value3',
        attr4: 'value4',
        attr5: 'value5',
        attr6: 'value6',
        attr7: 'value7',
      }

      diagnosticsMetrics.recordLatency([0, 1000000], attributes)

      expect(recordedHistogramCalls[0].attributes).toEqual(attributes)
      expect(warnSpy).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('should limit attributes to 7 and warn when exceeded (recordLatency)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const attributes = {
        attr1: 'value1',
        attr2: 'value2',
        attr3: 'value3',
        attr4: 'value4',
        attr5: 'value5',
        attr6: 'value6',
        attr7: 'value7',
        attr8: 'value8',
      }

      diagnosticsMetrics.recordLatency([0, 1000000], attributes)

      // Should only include first 7 attributes
      const recorded = recordedHistogramCalls[0].attributes
      expect(Object.keys(recorded)).toHaveLength(7)
      expect(recorded).toEqual({
        attr1: 'value1',
        attr2: 'value2',
        attr3: 'value3',
        attr4: 'value4',
        attr5: 'value5',
        attr6: 'value6',
        attr7: 'value7',
      })

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attribute limit exceeded: 8 attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })

    it('should limit attributes to 7 and warn when exceeded (incrementCounter)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const attributes = {
        attr1: 'value1',
        attr2: 'value2',
        attr3: 'value3',
        attr4: 'value4',
        attr5: 'value5',
        attr6: 'value6',
        attr7: 'value7',
        attr8: 'value8',
      }

      diagnosticsMetrics.incrementCounter('test_counter', 1, attributes)

      // Should only include first 7 attributes
      const recorded = recordedCounterCalls.get('test_counter')![0].attributes
      expect(Object.keys(recorded)).toHaveLength(7)
      expect(recorded).toEqual({
        attr1: 'value1',
        attr2: 'value2',
        attr3: 'value3',
        attr4: 'value4',
        attr5: 'value5',
        attr6: 'value6',
        attr7: 'value7',
      })

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attribute limit exceeded: 8 attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })

    it('should limit attributes to 7 and warn when exceeded (setGauge)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const attributes = {
        attr1: 'value1',
        attr2: 'value2',
        attr3: 'value3',
        attr4: 'value4',
        attr5: 'value5',
        attr6: 'value6',
        attr7: 'value7',
        attr8: 'value8',
      }

      diagnosticsMetrics.setGauge('test_gauge', 100, attributes)

      // Should only include first 7 attributes
      const recorded = recordedGaugeCalls.get('test_gauge')![0].attributes
      expect(Object.keys(recorded)).toHaveLength(7)
      expect(recorded).toEqual({
        attr1: 'value1',
        attr2: 'value2',
        attr3: 'value3',
        attr4: 'value4',
        attr5: 'value5',
        attr6: 'value6',
        attr7: 'value7',
      })

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attribute limit exceeded: 8 attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })
  })
})
