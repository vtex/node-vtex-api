import { Types } from '@vtex/diagnostics-nodejs'
import { context } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { DiagnosticsMetrics, TrackedCache } from './DiagnosticsMetrics'

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

// Set up OpenTelemetry context manager for async context propagation
const contextManager = new AsyncHooksContextManager()
contextManager.enable()
context.setGlobalContextManager(contextManager)

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

    it('should allow up to 7 custom attributes without warning', async () => {
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

    it('should limit custom attributes to 7 and warn when exceeded (recordLatency)', async () => {
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

      // Should only include first 7 custom attributes
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
        expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })

    it('should limit custom attributes to 7 and warn when exceeded (incrementCounter)', async () => {
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

      // Should only include first 7 custom attributes
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
        expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })

    it('should limit custom attributes to 7 and warn when exceeded (setGauge)', async () => {
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

      // Should only include first 7 custom attributes
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
        expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })
  })

  describe('Base Attributes Merging (runWithBaseAttributes)', () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    describe('recordLatency', () => {
      it('should merge base attributes with custom attributes', () => {
        const baseAttributes = { account: 'testaccount', route_id: 'test-route' }
        const customAttributes = { operation: 'custom-op', status: 'success' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'testaccount',
          route_id: 'test-route',
          operation: 'custom-op',
          status: 'success',
        })
      })

      it('should give base attributes precedence over custom attributes on conflicts', () => {
        const baseAttributes = { status: 'base-status', account: 'base-account' }
        const customAttributes = { status: 'custom-status', operation: 'test-op' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'base-account',
          status: 'base-status', // Base takes precedence, custom 'status' is dropped
          operation: 'test-op', // Non-conflicting custom attribute is kept
        })
      })

      it('should silently drop conflicting custom attributes without warnings', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        
        const baseAttributes = { 
          account: 'base-account',
          route_id: 'base-route',
          component: 'base-component',
        }
        const customAttributes = { 
          account: 'custom-account', // Conflicts - should be dropped
          route_id: 'custom-route', // Conflicts - should be dropped
          operation: 'custom-op', // No conflict - should be kept
          status: 'success', // No conflict - should be kept
        }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        // Verify no warnings were logged for conflicting attributes
        expect(warnSpy).not.toHaveBeenCalled()

        // Verify base attributes are preserved, conflicting custom attributes dropped
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'base-account', // Base preserved
          route_id: 'base-route', // Base preserved
          component: 'base-component', // Base preserved
          operation: 'custom-op', // Non-conflicting custom kept
          status: 'success', // Non-conflicting custom kept
        })

        warnSpy.mockRestore()
      })

      it('should use only base attributes when no custom attributes provided', () => {
        const baseAttributes = { account: 'testaccount', route_id: 'test-route' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual(baseAttributes)
      })

      it('should use only custom attributes when outside base attributes context', () => {
        const customAttributes = { operation: 'custom-op' }

        diagnosticsMetrics.recordLatency(100, customAttributes)

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual(customAttributes)
      })

      it('should work with nested runWithBaseAttributes calls (inner takes precedence)', () => {
        const outerBase = { account: 'outer-account', level: 'outer' }
        const innerBase = { account: 'inner-account', level: 'inner' }
        const customAttributes = { operation: 'test' }

        diagnosticsMetrics.runWithBaseAttributes(outerBase, () => {
          diagnosticsMetrics.runWithBaseAttributes(innerBase, () => {
            diagnosticsMetrics.recordLatency(100, customAttributes)
          })
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'inner-account',
          level: 'inner',
          operation: 'test',
        })
      })
    })

    describe('incrementCounter', () => {
      it('should merge base attributes with custom attributes', () => {
        const baseAttributes = { account: 'testaccount' }
        const customAttributes = { method: 'GET' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.incrementCounter('http_requests_total', 1, customAttributes)
        })

        const calls = recordedCounterCalls.get('http_requests_total')
        expect(calls).toHaveLength(1)
        expect(calls![0].attributes).toEqual({
          account: 'testaccount',
          method: 'GET',
        })
      })

      it('should give base attributes precedence over custom attributes on conflicts', () => {
        const baseAttributes = { status: 'base', account: 'base-account' }
        const customAttributes = { status: 'custom', method: 'GET' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.incrementCounter('test_counter', 1, customAttributes)
        })

        const calls = recordedCounterCalls.get('test_counter')
        expect(calls![0].attributes).toEqual({ 
          status: 'base', // Base takes precedence
          account: 'base-account',
          method: 'GET', // Non-conflicting custom attribute is kept
        })
      })
    })

    describe('setGauge', () => {
      it('should merge base attributes with custom attributes', () => {
        const baseAttributes = { environment: 'production' }
        const customAttributes = { cache: 'pages' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.setGauge('cache_items_current', 1024, customAttributes)
        })

        const calls = recordedGaugeCalls.get('cache_items_current')
        expect(calls).toHaveLength(1)
        expect(calls![0].attributes).toEqual({
          environment: 'production',
          cache: 'pages',
        })
      })

      it('should give base attributes precedence over custom attributes on conflicts', () => {
        const baseAttributes = { type: 'base', environment: 'prod' }
        const customAttributes = { type: 'custom', cache: 'pages' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.setGauge('test_gauge', 100, customAttributes)
        })

        const calls = recordedGaugeCalls.get('test_gauge')
        expect(calls![0].attributes).toEqual({ 
          type: 'base', // Base takes precedence
          environment: 'prod',
          cache: 'pages', // Non-conflicting custom attribute is kept
        })
      })
    })

    describe('async operations', () => {
      it('should maintain base attributes context through async operations', async () => {
        const baseAttributes = { account: 'async-account' }
        const customAttributes = { operation: 'async-op' }

        await diagnosticsMetrics.runWithBaseAttributes(baseAttributes, async () => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 5))
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'async-account',
          operation: 'async-op',
        })
      })

      it('should isolate context between concurrent async operations', async () => {
        const baseAttrs1 = { account: 'account1' }
        const baseAttrs2 = { account: 'account2' }

        await Promise.all([
          diagnosticsMetrics.runWithBaseAttributes(baseAttrs1, async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            diagnosticsMetrics.recordLatency(100, { op: 'op1' })
          }),
          diagnosticsMetrics.runWithBaseAttributes(baseAttrs2, async () => {
            await new Promise(resolve => setTimeout(resolve, 5))
            diagnosticsMetrics.recordLatency(200, { op: 'op2' })
          }),
        ])

        expect(recordedHistogramCalls).toHaveLength(2)
        
        // Order might vary due to timing, so check both are present
        const attrs = recordedHistogramCalls.map(c => c.attributes)
        expect(attrs).toContainEqual({ account: 'account1', op: 'op1' })
        expect(attrs).toContainEqual({ account: 'account2', op: 'op2' })
      })
    })

    describe('attribute limiting with base attributes', () => {
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

      it('should limit only custom attributes to 7, not base attributes', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        
        const baseAttributes = {
          base1: 'value1',
          base2: 'value2',
          base3: 'value3',
          base4: 'value4',
        }
        const customAttributes = {
          custom1: 'value1',
          custom2: 'value2',
          custom3: 'value3',
          custom4: 'value4',
          custom5: 'value5',
          custom6: 'value6',
          custom7: 'value7',
          custom8: 'value8', // This should be dropped
        }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        // 4 base attributes + 7 custom attributes (8th custom dropped) = 11 total
        const recorded = recordedHistogramCalls[0].attributes
        expect(Object.keys(recorded)).toHaveLength(11)
        
        // Verify all base attributes are present
        expect(recorded.base1).toBe('value1')
        expect(recorded.base2).toBe('value2')
        expect(recorded.base3).toBe('value3')
        expect(recorded.base4).toBe('value4')
        
        // Verify only first 7 custom attributes are present
        expect(recorded.custom1).toBe('value1')
        expect(recorded.custom2).toBe('value2')
        expect(recorded.custom3).toBe('value3')
        expect(recorded.custom4).toBe('value4')
        expect(recorded.custom5).toBe('value5')
        expect(recorded.custom6).toBe('value6')
        expect(recorded.custom7).toBe('value7')
        expect(recorded.custom8).toBeUndefined() // 8th custom attribute should be dropped

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
        )

        warnSpy.mockRestore()
      })
    })
  })

  describe('registerObservableGauge / registerObservableCounter', () => {
    // These reach the SDK through metricsClient.getProvider().getMeter(...), so this
    // block mocks the Meter directly instead of the createCounter/Gauge/Histogram wrapper.
    let gaugeInstruments: Map<string, { addCallback: jest.Mock; removeCallback: jest.Mock }>
    let counterInstruments: Map<string, { addCallback: jest.Mock; removeCallback: jest.Mock }>
    let observableMeter: {
      createObservableGauge: jest.Mock
      createObservableCounter: jest.Mock
      addBatchObservableCallback: jest.Mock
    }
    let observableMetricsClient: Types.MetricClient
    let observableDiagnostics: DiagnosticsMetrics

    function fakeInstrumentFactory(instruments: Map<string, { addCallback: jest.Mock; removeCallback: jest.Mock }>) {
      return jest.fn((name: string) => {
        if (!instruments.has(name)) {
          instruments.set(name, { addCallback: jest.fn(), removeCallback: jest.fn() })
        }
        return instruments.get(name)
      })
    }

    beforeEach(async () => {
      gaugeInstruments = new Map()
      counterInstruments = new Map()
      observableMeter = {
        createObservableGauge: fakeInstrumentFactory(gaugeInstruments),
        createObservableCounter: fakeInstrumentFactory(counterInstruments),
        addBatchObservableCallback: jest.fn(),
      }
      observableMetricsClient = {
        createHistogram: jest.fn(),
        createCounter: jest.fn(),
        createGauge: jest.fn(),
        getProvider: () => ({ getMeter: () => observableMeter }),
      } as any

      ;(getMetricClient as jest.Mock).mockResolvedValue(observableMetricsClient)
      observableDiagnostics = new DiagnosticsMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('creates the instrument (passing options through) and attaches the callback', () => {
      const observe = jest.fn()
      observableDiagnostics.registerObservableGauge('queue_depth_current', observe, { unit: '1' })

      expect(observableMeter.createObservableGauge).toHaveBeenCalledWith('queue_depth_current', { unit: '1' })
      expect(gaugeInstruments.get('queue_depth_current')!.addCallback).toHaveBeenCalledWith(observe)
    })

    it('reuses the instrument and replaces the previous callback on re-registration', () => {
      const first = jest.fn()
      const second = jest.fn()

      observableDiagnostics.registerObservableGauge('queue_depth_current', first)
      observableDiagnostics.registerObservableGauge('queue_depth_current', second)

      const instrument = gaugeInstruments.get('queue_depth_current')!
      expect(observableMeter.createObservableGauge).toHaveBeenCalledTimes(1)
      expect(instrument.removeCallback).toHaveBeenCalledWith(first)
      expect(instrument.addCallback).toHaveBeenCalledWith(second)
    })

    it('detaches on dispose; the disposer is a no-op if called again', () => {
      const observe = jest.fn()
      const dispose = observableDiagnostics.registerObservableGauge('queue_depth_current', observe)

      dispose()
      dispose()

      expect(gaugeInstruments.get('queue_depth_current')!.removeCallback).toHaveBeenCalledTimes(1)
    })

    it('registerObservableCounter creates a counter instrument (same code path as the gauge)', () => {
      const observe = jest.fn()
      observableDiagnostics.registerObservableCounter('jobs_processed_total', observe)

      expect(observableMeter.createObservableCounter).toHaveBeenCalledWith('jobs_processed_total', undefined)
      expect(counterInstruments.get('jobs_processed_total')!.addCallback).toHaveBeenCalledWith(observe)
    })

    it('queues the registration when the client is not ready yet, and applies it once it is', async () => {
      let resolveClient!: (client: Types.MetricClient) => void
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(
        new Promise<Types.MetricClient>(resolve => { resolveClient = resolve })
      )

      const pending = new DiagnosticsMetrics()
      const observe = jest.fn()
      pending.registerObservableGauge('startup_queue_depth', observe)

      expect(observableMeter.createObservableGauge).not.toHaveBeenCalledWith('startup_queue_depth', undefined)

      resolveClient(observableMetricsClient)
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(gaugeInstruments.get('startup_queue_depth')!.addCallback).toHaveBeenCalledWith(observe)
    })

    it('disposing a still-pending registration prevents it from being applied once ready', async () => {
      let resolveClient!: (client: Types.MetricClient) => void
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(
        new Promise<Types.MetricClient>(resolve => { resolveClient = resolve })
      )

      const pending = new DiagnosticsMetrics()
      const dispose = pending.registerObservableGauge('cancelled_before_ready', jest.fn())

      dispose()
      resolveClient(observableMetricsClient)
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(observableMeter.createObservableGauge).not.toHaveBeenCalledWith('cancelled_before_ready', undefined)
    })
  })

  describe('trackCache', () => {
    // Exercised against a real MeterProvider + MetricReader instead of a mock: the
    // single-read-per-cycle and delta-to-cumulative accounting are easy to get wrong
    // in a way a mock would still pass.
    let provider: MeterProvider
    let reader: PeriodicExportingMetricReader
    let exporter: InMemoryMetricExporter
    let cacheMetricsClient: Types.MetricClient
    let cacheDiagnostics: DiagnosticsMetrics

    interface CacheStatsFixture {
      [key: string]: number | boolean | string | undefined
    }
    type CollectionResult = Awaited<ReturnType<PeriodicExportingMetricReader['collect']>>

    function fakeCache(sequence: CacheStatsFixture[]): TrackedCache {
      let call = 0
      return {
        getStats: () => sequence[Math.min(call++, sequence.length - 1)],
      }
    }

    // reader.collect() returns the data directly; it doesn't go through the exporter
    // (that only happens on the reader's own timer, which never fires in this suite).
    function dataPointsIn(
      result: CollectionResult,
      metricName: string
    ): Array<{ value: number; attributes: Record<string, unknown> }> {
      const points: Array<{ value: number; attributes: Record<string, unknown> }> = []
      for (const scopeMetrics of result.resourceMetrics.scopeMetrics) {
        for (const metric of scopeMetrics.metrics) {
          if (metric.descriptor.name === metricName) {
            for (const dataPoint of (metric as any).dataPoints) {
              points.push({ value: dataPoint.value as number, attributes: dataPoint.attributes })
            }
          }
        }
      }

      return points
    }

    function allMetricNamesIn(result: CollectionResult): string[] {
      return result.resourceMetrics.scopeMetrics.flatMap(sm => sm.metrics.map(m => m.descriptor.name))
    }

    beforeEach(async () => {
      exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
      reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000000 }) // never fires; collect() is manual
      provider = new MeterProvider({ readers: [reader] })

      cacheMetricsClient = {
        createHistogram: jest.fn(),
        createCounter: jest.fn(() => ({ add: jest.fn() })),
        createGauge: jest.fn(() => ({ set: jest.fn() })),
        getProvider: () => provider,
      } as any

      ;(getMetricClient as jest.Mock).mockResolvedValue(cacheMetricsClient)
      cacheDiagnostics = new DiagnosticsMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    afterEach(async () => {
      await provider.shutdown()
    })

    it('reports hits and misses split by cache_state', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 3, total: 5 }]))

      const ops = dataPointsIn(await reader.collect(), 'io_app_cache_operations_total')

      expect(ops).toContainEqual({ value: 3, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(ops).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('accumulates across collection cycles instead of treating each delta as the total', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([
        { hits: 3, total: 5 },
        { hits: 2, total: 2 },
      ]))

      await reader.collect()
      const second = await reader.collect()

      const ops = dataPointsIn(second, 'io_app_cache_operations_total')
      // cumulative hits: 3 + 2 = 5; cumulative misses: (5-3) + (2-2) = 2 + 0 = 2
      expect(ops).toContainEqual({ value: 5, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(ops).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('reads a cache exactly once per cycle no matter how many metrics it feeds', async () => {
      const getStats = jest.fn().mockReturnValue({ hits: 1, total: 1, itemCount: 10, max: 100, disposedItems: 1 })
      cacheDiagnostics.trackCache('pages', { getStats })

      await reader.collect()

      expect(getStats).toHaveBeenCalledTimes(1)
    })

    it('reports itemCount, max and disposedItems only for caches that expose them', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1, itemCount: 10, max: 100, disposedItems: 2 }]))
      cacheDiagnostics.trackCache('assets-disk', fakeCache([{ hits: 1, total: 1 }])) // DiskCache shape: no itemCount/max/disposedItems

      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_items_current')).toEqual([
        { value: 10, attributes: { cache: 'pages' } },
      ])
      expect(dataPointsIn(result, 'io_app_cache_capacity')).toEqual([
        { value: 100, attributes: { cache: 'pages' } },
      ])
      expect(dataPointsIn(result, 'io_app_cache_disposed_total')).toEqual([
        { value: 2, attributes: { cache: 'pages' } },
      ])
    })

    it('stops reporting a cache once its disposer is called', async () => {
      const dispose = cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1 }]))

      dispose()
      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_operations_total')).toHaveLength(0)
    })

    it('does not publish hitRate', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 3, total: 5, hitRate: 0.6 }]))

      const result = await reader.collect()

      expect(allMetricNamesIn(result)).not.toEqual(expect.arrayContaining([expect.stringMatching(/hit.?rate/i)]))
    })

    it('does not create the meter for apps that never call trackCache', () => {
      const getProviderSpy = jest.spyOn(cacheMetricsClient, 'getProvider')

      cacheDiagnostics.incrementCounter('unrelated_total', 1)

      expect(getProviderSpy).not.toHaveBeenCalled()
    })

    it('recovers from a cache whose getStats() throws, without dropping other caches', async () => {
      const throwingCache: TrackedCache = {
        getStats: () => {
          throw new Error('boom')
        },
      }
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const disposeBroken = cacheDiagnostics.trackCache('broken', throwingCache)
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1 }]))

      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_operations_total')).toContainEqual({
        value: 1,
        attributes: { cache: 'pages', cache_state: 'hit' },
      })
      expect(errorSpy).toHaveBeenCalled()

      disposeBroken() // avoid a second throw during afterEach's shutdown-triggered collect
      errorSpy.mockRestore()
    })
  })
})

import { Types } from '@vtex/diagnostics-nodejs'
import { context } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { DiagnosticsMetrics, TrackedCache } from './DiagnosticsMetrics'

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

// Set up OpenTelemetry context manager for async context propagation
const contextManager = new AsyncHooksContextManager()
contextManager.enable()
context.setGlobalContextManager(contextManager)

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

    it('should timeout if metric client initialization takes too long', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock getMetricClient to never resolve
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(new Promise(() => {}))

      const timeoutMetrics = new DiagnosticsMetrics()
      
      // Wait for timeout to trigger (METRIC_CLIENT_INIT_TIMEOUT_MS is typically 5000ms)
      // We can't wait that long in a test, so we just verify the promise rejects eventually
      await new Promise(resolve => setTimeout(resolve, 5100))

      // Verify error was logged for timeout
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize metric client:',
        expect.objectContaining({ message: expect.stringContaining('timeout') })
      )

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

    it('should handle zero-value latency', () => {
      diagnosticsMetrics.recordLatency(0)
      expect(recordedHistogramCalls).toHaveLength(1)
      expect(recordedHistogramCalls[0].value).toBe(0)
    })

    it('should handle negative hrtime nanoseconds by converting correctly', () => {
      // Edge case: if nanoseconds are at boundary
      const hrtimeDiff: [number, number] = [0, 999999999]
      diagnosticsMetrics.recordLatency(hrtimeDiff)
      
      // 0 seconds + 999999999 nanoseconds ≈ 999.999999 ms (rounded based on division)
      expect(recordedHistogramCalls[0].value).toBeCloseTo(999.9999990, 5)
    })

    it('should handle large hrtime values', () => {
      const hrtimeDiff: [number, number] = [3600, 0] // 1 hour
      diagnosticsMetrics.recordLatency(hrtimeDiff)
      
      expect(recordedHistogramCalls[0].value).toBe(3600000)
    })

    it('should convert very small hrtime nanoseconds correctly', () => {
      const hrtimeDiff: [number, number] = [0, 1] // 1 nanosecond
      diagnosticsMetrics.recordLatency(hrtimeDiff)
      
      // 1ns / 1e6 = 0.000001ms
      expect(recordedHistogramCalls[0].value).toBeCloseTo(0.000001, 9)
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

    it('should increment counter by zero', () => {
      diagnosticsMetrics.incrementCounter('test', 0)
      expect(recordedCounterCalls.get('test')![0].value).toBe(0)
    })

    it('should handle negative increment values', () => {
      diagnosticsMetrics.incrementCounter('test', -5)
      expect(recordedCounterCalls.get('test')![0].value).toBe(-5)
    })

    it('should handle very large increment values', () => {
      diagnosticsMetrics.incrementCounter('test', Number.MAX_SAFE_INTEGER)
      expect(recordedCounterCalls.get('test')![0].value).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should handle fractional increment values', () => {
      diagnosticsMetrics.incrementCounter('test', 3.14159)
      expect(recordedCounterCalls.get('test')![0].value).toBe(3.14159)
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

    it('should set gauge to zero', () => {
      diagnosticsMetrics.setGauge('test', 0)
      expect(recordedGaugeCalls.get('test')![0].value).toBe(0)
    })

    it('should set gauge to negative value', () => {
      diagnosticsMetrics.setGauge('test', -100)
      expect(recordedGaugeCalls.get('test')![0].value).toBe(-100)
    })

    it('should set gauge to very large value', () => {
      diagnosticsMetrics.setGauge('test', Number.MAX_SAFE_INTEGER)
      expect(recordedGaugeCalls.get('test')![0].value).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should set gauge to fractional value', () => {
      diagnosticsMetrics.setGauge('test', 3.14159)
      expect(recordedGaugeCalls.get('test')![0].value).toBe(3.14159)
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

    it('should allow up to 7 custom attributes without warning', async () => {
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

    it('should limit custom attributes to 7 and warn when exceeded (recordLatency)', async () => {
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

      // Should only include first 7 custom attributes
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
        expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })

    it('should limit custom attributes to 7 and warn when exceeded (incrementCounter)', async () => {
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

      // Should only include first 7 custom attributes
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
        expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })

    it('should limit custom attributes to 7 and warn when exceeded (setGauge)', async () => {
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

      // Should only include first 7 custom attributes
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
        expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
      )

      warnSpy.mockRestore()
    })

    it('should not warn when LINKED is false even if limit is exceeded', async () => {
      const constants = require('../constants')
      Object.defineProperty(constants, 'LINKED', {
        value: false,
        writable: true,
        configurable: true,
      })

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

      // Still limits attributes but doesn't warn
      expect(recordedHistogramCalls[0].attributes).toHaveProperty('attr7')
      expect(recordedHistogramCalls[0].attributes).not.toHaveProperty('attr8')
      expect(warnSpy).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('should handle empty custom attributes object', () => {
      const attributes = {}
      diagnosticsMetrics.recordLatency(100, attributes)
      expect(recordedHistogramCalls[0].attributes).toEqual({})
    })

    it('should handle null custom attributes as undefined', () => {
      diagnosticsMetrics.recordLatency(100, null as any)
      expect(recordedHistogramCalls[0].attributes).toBeUndefined()
    })
  })

  describe('Base Attributes Merging (runWithBaseAttributes)', () => {
    beforeEach(async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    describe('recordLatency', () => {
      it('should merge base attributes with custom attributes', () => {
        const baseAttributes = { account: 'testaccount', route_id: 'test-route' }
        const customAttributes = { operation: 'custom-op', status: 'success' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'testaccount',
          route_id: 'test-route',
          operation: 'custom-op',
          status: 'success',
        })
      })

      it('should give base attributes precedence over custom attributes on conflicts', () => {
        const baseAttributes = { status: 'base-status', account: 'base-account' }
        const customAttributes = { status: 'custom-status', operation: 'test-op' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'base-account',
          status: 'base-status', // Base takes precedence, custom 'status' is dropped
          operation: 'test-op', // Non-conflicting custom attribute is kept
        })
      })

      it('should silently drop conflicting custom attributes without warnings', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        
        const baseAttributes = { 
          account: 'base-account',
          route_id: 'base-route',
          component: 'base-component',
        }
        const customAttributes = { 
          account: 'custom-account', // Conflicts - should be dropped
          route_id: 'custom-route', // Conflicts - should be dropped
          operation: 'custom-op', // No conflict - should be kept
          status: 'success', // No conflict - should be kept
        }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        // Verify no warnings were logged for conflicting attributes
        expect(warnSpy).not.toHaveBeenCalled()

        // Verify base attributes are preserved, conflicting custom attributes dropped
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'base-account', // Base preserved
          route_id: 'base-route', // Base preserved
          component: 'base-component', // Base preserved
          operation: 'custom-op', // Non-conflicting custom kept
          status: 'success', // Non-conflicting custom kept
        })

        warnSpy.mockRestore()
      })

      it('should use only base attributes when no custom attributes provided', () => {
        const baseAttributes = { account: 'testaccount', route_id: 'test-route' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual(baseAttributes)
      })

      it('should use only custom attributes when outside base attributes context', () => {
        const customAttributes = { operation: 'custom-op' }

        diagnosticsMetrics.recordLatency(100, customAttributes)

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual(customAttributes)
      })

      it('should work with nested runWithBaseAttributes calls (inner takes precedence)', () => {
        const outerBase = { account: 'outer-account', level: 'outer' }
        const innerBase = { account: 'inner-account', level: 'inner' }
        const customAttributes = { operation: 'test' }

        diagnosticsMetrics.runWithBaseAttributes(outerBase, () => {
          diagnosticsMetrics.runWithBaseAttributes(innerBase, () => {
            diagnosticsMetrics.recordLatency(100, customAttributes)
          })
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'inner-account',
          level: 'inner',
          operation: 'test',
        })
      })
    })

    describe('incrementCounter', () => {
      it('should merge base attributes with custom attributes', () => {
        const baseAttributes = { account: 'testaccount' }
        const customAttributes = { method: 'GET' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.incrementCounter('http_requests_total', 1, customAttributes)
        })

        const calls = recordedCounterCalls.get('http_requests_total')
        expect(calls).toHaveLength(1)
        expect(calls![0].attributes).toEqual({
          account: 'testaccount',
          method: 'GET',
        })
      })

      it('should give base attributes precedence over custom attributes on conflicts', () => {
        const baseAttributes = { status: 'base', account: 'base-account' }
        const customAttributes = { status: 'custom', method: 'GET' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.incrementCounter('test_counter', 1, customAttributes)
        })

        const calls = recordedCounterCalls.get('test_counter')
        expect(calls![0].attributes).toEqual({ 
          status: 'base', // Base takes precedence
          account: 'base-account',
          method: 'GET', // Non-conflicting custom attribute is kept
        })
      })
    })

    describe('setGauge', () => {
      it('should merge base attributes with custom attributes', () => {
        const baseAttributes = { environment: 'production' }
        const customAttributes = { cache: 'pages' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.setGauge('cache_items_current', 1024, customAttributes)
        })

        const calls = recordedGaugeCalls.get('cache_items_current')
        expect(calls).toHaveLength(1)
        expect(calls![0].attributes).toEqual({
          environment: 'production',
          cache: 'pages',
        })
      })

      it('should give base attributes precedence over custom attributes on conflicts', () => {
        const baseAttributes = { type: 'base', environment: 'prod' }
        const customAttributes = { type: 'custom', cache: 'pages' }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.setGauge('test_gauge', 100, customAttributes)
        })

        const calls = recordedGaugeCalls.get('test_gauge')
        expect(calls![0].attributes).toEqual({ 
          type: 'base', // Base takes precedence
          environment: 'prod',
          cache: 'pages', // Non-conflicting custom attribute is kept
        })
      })
    })

    describe('async operations', () => {
      it('should maintain base attributes context through async operations', async () => {
        const baseAttributes = { account: 'async-account' }
        const customAttributes = { operation: 'async-op' }

        await diagnosticsMetrics.runWithBaseAttributes(baseAttributes, async () => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 5))
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        expect(recordedHistogramCalls).toHaveLength(1)
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'async-account',
          operation: 'async-op',
        })
      })

      it('should isolate context between concurrent async operations', async () => {
        const baseAttrs1 = { account: 'account1' }
        const baseAttrs2 = { account: 'account2' }

        await Promise.all([
          diagnosticsMetrics.runWithBaseAttributes(baseAttrs1, async () => {
            await new Promise(resolve => setTimeout(resolve, 10))
            diagnosticsMetrics.recordLatency(100, { op: 'op1' })
          }),
          diagnosticsMetrics.runWithBaseAttributes(baseAttrs2, async () => {
            await new Promise(resolve => setTimeout(resolve, 5))
            diagnosticsMetrics.recordLatency(200, { op: 'op2' })
          }),
        ])

        expect(recordedHistogramCalls).toHaveLength(2)
        
        // Order might vary due to timing, so check both are present
        const attrs = recordedHistogramCalls.map(c => c.attributes)
        expect(attrs).toContainEqual({ account: 'account1', op: 'op1' })
        expect(attrs).toContainEqual({ account: 'account2', op: 'op2' })
      })
    })

    describe('attribute limiting with base attributes', () => {
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

      it('should limit only custom attributes to 7, not base attributes', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        
        const baseAttributes = {
          base1: 'value1',
          base2: 'value2',
          base3: 'value3',
          base4: 'value4',
        }
        const customAttributes = {
          custom1: 'value1',
          custom2: 'value2',
          custom3: 'value3',
          custom4: 'value4',
          custom5: 'value5',
          custom6: 'value6',
          custom7: 'value7',
          custom8: 'value8', // This should be dropped
        }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        // 4 base attributes + 7 custom attributes (8th custom dropped) = 11 total
        const recorded = recordedHistogramCalls[0].attributes
        expect(Object.keys(recorded)).toHaveLength(11)
        
        // Verify all base attributes are present
        expect(recorded.base1).toBe('value1')
        expect(recorded.base2).toBe('value2')
        expect(recorded.base3).toBe('value3')
        expect(recorded.base4).toBe('value4')
        
        // Verify only first 7 custom attributes are present
        expect(recorded.custom1).toBe('value1')
        expect(recorded.custom2).toBe('value2')
        expect(recorded.custom3).toBe('value3')
        expect(recorded.custom4).toBe('value4')
        expect(recorded.custom5).toBe('value5')
        expect(recorded.custom6).toBe('value6')
        expect(recorded.custom7).toBe('value7')
        expect(recorded.custom8).toBeUndefined() // 8th custom attribute should be dropped

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Custom attribute limit exceeded: 8 custom attributes provided, using only the first 7')
        )

        warnSpy.mockRestore()
      })
    })
  })

  describe('registerObservableGauge / registerObservableCounter', () => {
    // These reach the SDK through metricsClient.getProvider().getMeter(...), so this
    // block mocks the Meter directly instead of the createCounter/Gauge/Histogram wrapper.
    let gaugeInstruments: Map<string, { addCallback: jest.Mock; removeCallback: jest.Mock }>
    let counterInstruments: Map<string, { addCallback: jest.Mock; removeCallback: jest.Mock }>
    let observableMeter: {
      createObservableGauge: jest.Mock
      createObservableCounter: jest.Mock
      addBatchObservableCallback: jest.Mock
    }
    let observableMetricsClient: Types.MetricClient
    let observableDiagnostics: DiagnosticsMetrics

    function fakeInstrumentFactory(instruments: Map<string, { addCallback: jest.Mock; removeCallback: jest.Mock }>) {
      return jest.fn((name: string) => {
        if (!instruments.has(name)) {
          instruments.set(name, { addCallback: jest.fn(), removeCallback: jest.fn() })
        }
        return instruments.get(name)
      })
    }

    beforeEach(async () => {
      gaugeInstruments = new Map()
      counterInstruments = new Map()
      observableMeter = {
        createObservableGauge: fakeInstrumentFactory(gaugeInstruments),
        createObservableCounter: fakeInstrumentFactory(counterInstruments),
        addBatchObservableCallback: jest.fn(),
      }
      observableMetricsClient = {
        createHistogram: jest.fn(),
        createCounter: jest.fn(),
        createGauge: jest.fn(),
        getProvider: () => ({ getMeter: () => observableMeter }),
      } as any

      ;(getMetricClient as jest.Mock).mockResolvedValue(observableMetricsClient)
      observableDiagnostics = new DiagnosticsMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('creates the instrument (passing options through) and attaches the callback', () => {
      const observe = jest.fn()
      observableDiagnostics.registerObservableGauge('queue_depth_current', observe, { unit: '1' })

      expect(observableMeter.createObservableGauge).toHaveBeenCalledWith('queue_depth_current', { unit: '1' })
      expect(gaugeInstruments.get('queue_depth_current')!.addCallback).toHaveBeenCalledWith(observe)
    })

    it('reuses the instrument and replaces the previous callback on re-registration', () => {
      const first = jest.fn()
      const second = jest.fn()

      observableDiagnostics.registerObservableGauge('queue_depth_current', first)
      observableDiagnostics.registerObservableGauge('queue_depth_current', second)

      const instrument = gaugeInstruments.get('queue_depth_current')!
      expect(observableMeter.createObservableGauge).toHaveBeenCalledTimes(1)
      expect(instrument.removeCallback).toHaveBeenCalledWith(first)
      expect(instrument.addCallback).toHaveBeenCalledWith(second)
    })

    it('detaches on dispose; the disposer is a no-op if called again', () => {
      const observe = jest.fn()
      const dispose = observableDiagnostics.registerObservableGauge('queue_depth_current', observe)

      dispose()
      dispose()

      expect(gaugeInstruments.get('queue_depth_current')!.removeCallback).toHaveBeenCalledTimes(1)
    })

    it('registerObservableCounter creates a counter instrument (same code path as the gauge)', () => {
      const observe = jest.fn()
      observableDiagnostics.registerObservableCounter('jobs_processed_total', observe)

      expect(observableMeter.createObservableCounter).toHaveBeenCalledWith('jobs_processed_total', undefined)
      expect(counterInstruments.get('jobs_processed_total')!.addCallback).toHaveBeenCalledWith(observe)
    })

    it('queues the registration when the client is not ready yet, and applies it once it is', async () => {
      let resolveClient!: (client: Types.MetricClient) => void
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(
        new Promise<Types.MetricClient>(resolve => { resolveClient = resolve })
      )

      const pending = new DiagnosticsMetrics()
      const observe = jest.fn()
      pending.registerObservableGauge('startup_queue_depth', observe)

      expect(observableMeter.createObservableGauge).not.toHaveBeenCalledWith('startup_queue_depth', undefined)

      resolveClient(observableMetricsClient)
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(gaugeInstruments.get('startup_queue_depth')!.addCallback).toHaveBeenCalledWith(observe)
    })

    it('disposing a still-pending registration prevents it from being applied once ready', async () => {
      let resolveClient!: (client: Types.MetricClient) => void
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(
        new Promise<Types.MetricClient>(resolve => { resolveClient = resolve })
      )

      const pending = new DiagnosticsMetrics()
      const dispose = pending.registerObservableGauge('cancelled_before_ready', jest.fn())

      dispose()
      resolveClient(observableMetricsClient)
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(observableMeter.createObservableGauge).not.toHaveBeenCalledWith('cancelled_before_ready', undefined)
    })
  })

  describe('trackCache', () => {
    // Exercised against a real MeterProvider + MetricReader instead of a mock: the
    // single-read-per-cycle and delta-to-cumulative accounting are easy to get wrong
    // in a way a mock would still pass.
    let provider: MeterProvider
    let reader: PeriodicExportingMetricReader
    let exporter: InMemoryMetricExporter
    let cacheMetricsClient: Types.MetricClient
    let cacheDiagnostics: DiagnosticsMetrics

    interface CacheStatsFixture {
      [key: string]: number | boolean | string | undefined
    }
    type CollectionResult = Awaited<ReturnType<PeriodicExportingMetricReader['collect']>>

    function fakeCache(sequence: CacheStatsFixture[]): TrackedCache {
      let call = 0
      return {
        getStats: () => sequence[Math.min(call++, sequence.length - 1)],
      }
    }

    // reader.collect() returns the data directly; it doesn't go through the exporter
    // (that only happens on the reader's own timer, which never fires in this suite).
    function dataPointsIn(
      result: CollectionResult,
      metricName: string
    ): Array<{ value: number; attributes: Record<string, unknown> }> {
      const points: Array<{ value: number; attributes: Record<string, unknown> }> = []
      for (const scopeMetrics of result.resourceMetrics.scopeMetrics) {
        for (const metric of scopeMetrics.metrics) {
          if (metric.descriptor.name === metricName) {
            for (const dataPoint of (metric as any).dataPoints) {
              points.push({ value: dataPoint.value as number, attributes: dataPoint.attributes })
            }
          }
        }
      }

      return points
    }

    function allMetricNamesIn(result: CollectionResult): string[] {
      return result.resourceMetrics.scopeMetrics.flatMap(sm => sm.metrics.map(m => m.descriptor.name))
    }

    beforeEach(async () => {
      exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
      reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000000 }) // never fires; collect() is manual
      provider = new MeterProvider({ readers: [reader] })

      cacheMetricsClient = {
        createHistogram: jest.fn(),
        createCounter: jest.fn(() => ({ add: jest.fn() })),
        createGauge: jest.fn(() => ({ set: jest.fn() })),
        getProvider: () => provider,
      } as any

      ;(getMetricClient as jest.Mock).mockResolvedValue(cacheMetricsClient)
      cacheDiagnostics = new DiagnosticsMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    afterEach(async () => {
      await provider.shutdown()
    })

    it('reports hits and misses split by cache_state', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 3, total: 5 }]))

      const ops = dataPointsIn(await reader.collect(), 'io_app_cache_operations_total')

      expect(ops).toContainEqual({ value: 3, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(ops).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('accumulates across collection cycles instead of treating each delta as the total', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([
        { hits: 3, total: 5 },
        { hits: 2, total: 2 },
      ]))

      await reader.collect()
      const second = await reader.collect()

      const ops = dataPointsIn(second, 'io_app_cache_operations_total')
      // cumulative hits: 3 + 2 = 5; cumulative misses: (5-3) + (2-2) = 2 + 0 = 2
      expect(ops).toContainEqual({ value: 5, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(ops).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('reads a cache exactly once per cycle no matter how many metrics it feeds', async () => {
      const getStats = jest.fn().mockReturnValue({ hits: 1, total: 1, itemCount: 10, max: 100, disposedItems: 1 })
      cacheDiagnostics.trackCache('pages', { getStats })

      await reader.collect()

      expect(getStats).toHaveBeenCalledTimes(1)
    })

    it('reports itemCount, max and disposedItems only for caches that expose them', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1, itemCount: 10, max: 100, disposedItems: 2 }]))
      cacheDiagnostics.trackCache('assets-disk', fakeCache([{ hits: 1, total: 1 }])) // DiskCache shape: no itemCount/max/disposedItems

      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_items_current')).toEqual([
        { value: 10, attributes: { cache: 'pages' } },
      ])
      expect(dataPointsIn(result, 'io_app_cache_capacity')).toEqual([
        { value: 100, attributes: { cache: 'pages' } },
      ])
      expect(dataPointsIn(result, 'io_app_cache_disposed_total')).toEqual([
        { value: 2, attributes: { cache: 'pages' } },
      ])
    })

    it('stops reporting a cache once its disposer is called', async () => {
      const dispose = cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1 }]))

      dispose()
      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_operations_total')).toHaveLength(0)
    })

    it('does not publish hitRate', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 3, total: 5, hitRate: 0.6 }]))

      const result = await reader.collect()

      expect(allMetricNamesIn(result)).not.toEqual(expect.arrayContaining([expect.stringMatching(/hit.?rate/i)]))
    })

    it('does not create the meter for apps that never call trackCache', () => {
      const getProviderSpy = jest.spyOn(cacheMetricsClient, 'getProvider')

      cacheDiagnostics.incrementCounter('unrelated_total', 1)

      expect(getProviderSpy).not.toHaveBeenCalled()
    })

    it('recovers from a cache whose getStats() throws, without dropping other caches', async () => {
      const throwingCache: TrackedCache = {
        getStats: () => {
          throw new Error('boom')
        },
      }
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const disposeBroken = cacheDiagnostics.trackCache('broken', throwingCache)
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1 }]))

      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_operations_total')).toContainEqual({
        value: 1,
        attributes: { cache: 'pages', cache_state: 'hit' },
      })
      expect(errorSpy).toHaveBeenCalled()

      disposeBroken() // avoid a second throw during afterEach's shutdown-triggered collect
      errorSpy.mockRestore()
    })
  })

  describe('Edge cases and error conditions', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should handle metric names with special characters', () => {
      diagnosticsMetrics.incrementCounter('metric-with-dashes_and_underscores', 1)
      expect(recordedCounterCalls.has('metric-with-dashes_and_underscores')).toBe(true)
    })

    it('should handle multiple gauge/counter operations without interference', () => {
      diagnosticsMetrics.setGauge('gauge1', 100)
      diagnosticsMetrics.incrementCounter('counter1', 5)
      diagnosticsMetrics.setGauge('gauge2', 200)
      diagnosticsMetrics.incrementCounter('counter2', 10)

      expect(recordedGaugeCalls.get('gauge1')![0].value).toBe(100)
      expect(recordedCounterCalls.get('counter1')![0].value).toBe(5)
      expect(recordedGaugeCalls.get('gauge2')![0].value).toBe(200)
      expect(recordedCounterCalls.get('counter2')![0].value).toBe(10)
    })

    it('should handle attribute values of different types', () => {
      const attributes = {
        string_attr: 'value',
        number_attr: 42,
        boolean_attr: true,
      }
      diagnosticsMetrics.recordLatency(100, attributes)
      expect(recordedHistogramCalls[0].attributes).toEqual(attributes)
    })

    it('should handle very long attribute keys', () => {
      const longKey = 'a'.repeat(1000)
      const attributes = { [longKey]: 'value' }
      diagnosticsMetrics.recordLatency(100, attributes)
      expect(recordedHistogramCalls[0].attributes).toHaveProperty(longKey)
    })

    it('should handle very long attribute values', () => {
      const longValue = 'x'.repeat(10000)
      const attributes = { key: longValue }
      diagnosticsMetrics.recordLatency(100, attributes)
      expect(recordedHistogramCalls[0].attributes?.key).toBe(longValue)
    })

    it('should call initialize multiple times without creating duplicate histograms', async () => {
      // Constructor already calls initMetricClient
      await new Promise(resolve => setTimeout(resolve, 10))
      const callsAfterInit = recordedHistogramCalls.length

      diagnosticsMetrics.recordLatency(100)
      const callsAfterFirstRecord = recordedHistogramCalls.length

      diagnosticsMetrics.recordLatency(200)
      const callsAfterSecondRecord = recordedHistogramCalls.length

      // Should only have two records, not duplicates
      expect(callsAfterSecondRecord - callsAfterFirstRecord).toBe(1)
    })

    it('should handle runWithBaseAttributes with function that throws', () => {
      const baseAttributes = { account: 'test' }
      const error = new Error('Function error')

      expect(() => {
        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          throw error
        })
      }).toThrow(error)
    })

    it('should handle runWithBaseAttributes with async function that rejects', async () => {
      const baseAttributes = { account: 'test' }
      const error = new Error('Async function error')

      await expect(
        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, async () => {
          throw error
        })
      ).rejects.toThrow(error)
    })

    it('should handle recordLatency with Infinity', () => {
      diagnosticsMetrics.recordLatency(Infinity)
      expect(recordedHistogramCalls[0].value).toBe(Infinity)
    })

    it('should handle recordLatency with NaN', () => {
      diagnosticsMetrics.recordLatency(NaN)
      expect(recordedHistogramCalls[0].value).toBeNaN()
    })
  })
})