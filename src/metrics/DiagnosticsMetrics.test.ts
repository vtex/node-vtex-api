import { Metrics, Types } from '@vtex/diagnostics-nodejs'
import { context, ObservableCallback } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { LRUCache } from '../caches/LRUCache'
import { CumulativeStats } from '../caches/typings'
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
    // These go through the library's observable API, so this block mocks
    // createObservableGauge/createObservableCounter and reproduces what the library
    // guarantees: the callback is attached to the instrument at creation, and the
    // returned wrapper's remove() detaches it.
    interface FakeObservable {
      instrument: { addCallback: jest.Mock; removeCallback: jest.Mock }
      remove: jest.Mock
      attached: ObservableCallback[]
    }

    let gaugeInstruments: Map<string, FakeObservable>
    let counterInstruments: Map<string, FakeObservable>
    let observableClient: {
      createObservableGauge: jest.Mock
      createObservableCounter: jest.Mock
      addBatchObservableCallback: jest.Mock
    }
    let observableMetricsClient: Types.MetricClient
    let observableDiagnostics: DiagnosticsMetrics

    function fakeObservableFactory(instruments: Map<string, FakeObservable>) {
      return jest.fn((name: string, observe?: ObservableCallback) => {
        let entry = instruments.get(name)
        if (!entry) {
          entry = { instrument: { addCallback: jest.fn(), removeCallback: jest.fn() }, remove: jest.fn(), attached: [] }
          instruments.set(name, entry)
        }

        const observable = entry
        if (observe) {
          observable.attached.push(observe)
          observable.instrument.addCallback(observe)
          observable.remove.mockImplementation(() => observable.instrument.removeCallback(observe))
        }

        return { instrument: observable.instrument, remove: observable.remove }
      })
    }

    beforeEach(async () => {
      gaugeInstruments = new Map()
      counterInstruments = new Map()
      observableClient = {
        createObservableGauge: fakeObservableFactory(gaugeInstruments),
        createObservableCounter: fakeObservableFactory(counterInstruments),
        addBatchObservableCallback: jest.fn(),
      }
      observableMetricsClient = {
        createHistogram: jest.fn(),
        createCounter: jest.fn(),
        createGauge: jest.fn(),
        createObservableGauge: observableClient.createObservableGauge,
        createObservableCounter: observableClient.createObservableCounter,
        addBatchObservableCallback: observableClient.addBatchObservableCallback,
        removeBatchObservableCallback: jest.fn(),
      } as any

      ;(getMetricClient as jest.Mock).mockResolvedValue(observableMetricsClient)
      observableDiagnostics = new DiagnosticsMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    // The callback handed to the instrument is a wrapper that applies the attribute
    // limit, so these assert delegation rather than function identity.
    function fireLast(instrument: { attached: ObservableCallback[] }, result: { observe: jest.Mock }) {
      instrument.attached[instrument.attached.length - 1](result as any)
    }

    it('creates the instrument (passing options through) and attaches the callback', () => {
      const observe = jest.fn()
      observableDiagnostics.registerObservableGauge('queue_depth_current', observe, { unit: '1' })

      expect(observableClient.createObservableGauge).toHaveBeenCalledWith(
        'queue_depth_current',
        expect.any(Function),
        { unit: '1' }
      )

      const instrument = gaugeInstruments.get('queue_depth_current')!
      expect(instrument.instrument.addCallback).toHaveBeenCalledTimes(1)
      fireLast(instrument, { observe: jest.fn() })
      expect(observe).toHaveBeenCalledTimes(1)
    })

    it('limits the attributes an observable callback reports', () => {
      const eightAttributes = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 }
      observableDiagnostics.registerObservableGauge('queue_depth_current', result => result.observe(1, eightAttributes))

      const observe = jest.fn()
      fireLast(gaugeInstruments.get('queue_depth_current')!, { observe })

      // MAX_CUSTOM_ATTRIBUTES is 7; the eighth is dropped, as with the push methods.
      expect(observe).toHaveBeenCalledWith(1, { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 })
    })

    it('leaves a within-limit attribute set untouched', () => {
      observableDiagnostics.registerObservableGauge('queue_depth_current', result => result.observe(3, { queue: 'x' }))

      const observe = jest.fn()
      fireLast(gaugeInstruments.get('queue_depth_current')!, { observe })

      expect(observe).toHaveBeenCalledWith(3, { queue: 'x' })
    })

    it('keeps one instrument and one attached callback across re-registration', () => {
      const first = jest.fn()
      const second = jest.fn()

      observableDiagnostics.registerObservableGauge('queue_depth_current', first)
      observableDiagnostics.registerObservableGauge('queue_depth_current', second)

      const instrument = gaugeInstruments.get('queue_depth_current')!
      expect(observableClient.createObservableGauge).toHaveBeenCalledTimes(1)
      // re-registration is a map update behind the callback that is already attached,
      // so the SDK is not touched and only `second` fires
      expect(instrument.instrument.addCallback).toHaveBeenCalledTimes(1)
      expect(instrument.instrument.removeCallback).not.toHaveBeenCalled()
      fireLast(instrument, { observe: jest.fn() })
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
    })

    it('refuses a name already registered as the other kind, instead of publishing two streams', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()
      const gauge = jest.fn()
      const counter = jest.fn()

      observableDiagnostics.registerObservableGauge('dup_metric', gauge)
      const dispose = observableDiagnostics.registerObservableCounter('dup_metric', counter)

      expect(observableClient.createObservableCounter).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('dup_metric'))
      expect(() => dispose()).not.toThrow()

      errorSpy.mockRestore()
    })

    it('detaches on dispose; the disposer is a no-op if called again', () => {
      const observe = jest.fn()
      const dispose = observableDiagnostics.registerObservableGauge('queue_depth_current', observe)

      dispose()
      dispose()

      expect(gaugeInstruments.get('queue_depth_current')!.remove).toHaveBeenCalledTimes(1)
    })

    it('registerObservableCounter creates a counter instrument (same code path as the gauge)', () => {
      const observe = jest.fn()
      observableDiagnostics.registerObservableCounter('jobs_processed_total', observe)

      expect(observableClient.createObservableCounter).toHaveBeenCalledWith(
        'jobs_processed_total',
        expect.any(Function),
        undefined
      )
      fireLast(counterInstruments.get('jobs_processed_total')!, { observe: jest.fn() })
      expect(observe).toHaveBeenCalledTimes(1)
    })

    it('replaces the callback on re-registration of a counter too', () => {
      const first = jest.fn()
      const second = jest.fn()

      observableDiagnostics.registerObservableCounter('jobs_processed_total', first)
      observableDiagnostics.registerObservableCounter('jobs_processed_total', second)

      const instrument = counterInstruments.get('jobs_processed_total')!
      expect(observableClient.createObservableCounter).toHaveBeenCalledTimes(1)
      fireLast(instrument, { observe: jest.fn() })
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
    })

    it('queues the registration when the client is not ready yet, and applies it once it is', async () => {
      let resolveClient!: (client: Types.MetricClient) => void
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(
        new Promise<Types.MetricClient>(resolve => { resolveClient = resolve })
      )

      const pending = new DiagnosticsMetrics()
      const observe = jest.fn()
      pending.registerObservableGauge('startup_queue_depth', observe)

      expect(observableClient.createObservableGauge).not.toHaveBeenCalled()

      resolveClient(observableMetricsClient)
      await new Promise(resolve => setTimeout(resolve, 10))

      fireLast(gaugeInstruments.get('startup_queue_depth')!, { observe: jest.fn() })
      expect(observe).toHaveBeenCalledTimes(1)
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

      expect(observableClient.createObservableGauge).not.toHaveBeenCalled()
    })
  })

  describe('trackCache', () => {
    // Exercised against a real MeterProvider + MetricReader instead of a mock: the
    // single-read-per-cycle accounting and the cumulative-counter contract are easy to
    // get wrong in a way a mock would still pass.
    let provider: MeterProvider
    let reader: PeriodicExportingMetricReader
    let exporter: InMemoryMetricExporter
    let cacheMetricsClient: Types.MetricClient
    let cacheDiagnostics: DiagnosticsMetrics

    type CollectionResult = Awaited<ReturnType<PeriodicExportingMetricReader['collect']>>

    // Values are cumulative, matching what a real cache's getCumulativeStats() reports.
    function fakeCache(sequence: Partial<CumulativeStats>[]): TrackedCache {
      let call = 0
      return {
        getCumulativeStats: () => sequence[Math.min(call++, sequence.length - 1)] as CumulativeStats,
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

    // The library's own client over a real provider: the observable instruments have to
    // reach a real meter for collect() to report them, and routing them through the
    // library is the path under test.
    function buildClient(temporality: AggregationTemporality) {
      exporter = new InMemoryMetricExporter(temporality)
      reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000000 }) // never fires; collect() is manual
      provider = new MeterProvider({ readers: [reader] })

      return new Metrics.MetricsClientImpl({ provider }, 'test-service', 'diagnostics-metrics-test')
    }

    beforeEach(async () => {
      cacheMetricsClient = buildClient(AggregationTemporality.CUMULATIVE)

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

    it('reports a monotonic total across collection cycles', async () => {
      cacheDiagnostics.trackCache('pages', fakeCache([
        { hits: 3, total: 5 },
        { hits: 5, total: 7 },
      ]))

      await reader.collect()
      const second = await reader.collect()

      const ops = dataPointsIn(second, 'io_app_cache_operations_total')
      expect(ops).toContainEqual({ value: 5, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(ops).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('shares a real cache with the legacy flush without either stealing counts', async () => {
      // The whole point of reading getCumulativeStats(): MetricsAccumulator keeps
      // calling getStats(), which consumes its own window, and this must not notice.
      const cache = new LRUCache<string, number>({ max: 10 })
      cache.set('a', 1)
      cacheDiagnostics.trackCache('pages', cache)

      cache.get('a')
      cache.get('absent')
      cache.getStats() // legacy flush
      const first = dataPointsIn(await reader.collect(), 'io_app_cache_operations_total')

      cache.get('a')
      cache.getStats() // legacy flush again
      const second = dataPointsIn(await reader.collect(), 'io_app_cache_operations_total')

      expect(first).toContainEqual({ value: 1, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(first).toContainEqual({ value: 1, attributes: { cache: 'pages', cache_state: 'miss' } })
      expect(second).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(second).toContainEqual({ value: 1, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('reports per-cycle deltas under the delta temporality used in production', async () => {
      (getMetricClient as jest.Mock).mockResolvedValue(buildClient(AggregationTemporality.DELTA))
      const deltaDiagnostics = new DiagnosticsMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))

      deltaDiagnostics.trackCache('pages', fakeCache([
        { hits: 3, total: 5 },
        { hits: 5, total: 7 },
      ]))

      const first = dataPointsIn(await reader.collect(), 'io_app_cache_operations_total')
      const second = dataPointsIn(await reader.collect(), 'io_app_cache_operations_total')

      expect(first).toContainEqual({ value: 3, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(second).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(second).toContainEqual({ value: 0, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('reads a cache exactly once per cycle no matter how many metrics it feeds', async () => {
      const getCumulativeStats = jest.fn().mockReturnValue({ hits: 1, total: 1, itemCount: 10, max: 100, disposedItems: 1 })
      cacheDiagnostics.trackCache('pages', { getCumulativeStats })

      await reader.collect()

      expect(getCumulativeStats).toHaveBeenCalledTimes(1)
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

    it('queues a cache registered before the client is ready, and applies it once it is', async () => {
      let resolveClient!: (client: Types.MetricClient) => void
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(
        new Promise<Types.MetricClient>(resolve => { resolveClient = resolve })
      )

      const pending = new DiagnosticsMetrics()
      pending.trackCache('pages', fakeCache([{ hits: 7, total: 9 }]))

      resolveClient(cacheMetricsClient)
      await new Promise(resolve => setTimeout(resolve, 10))

      const ops = dataPointsIn(await reader.collect(), 'io_app_cache_operations_total')
      expect(ops).toContainEqual({ value: 7, attributes: { cache: 'pages', cache_state: 'hit' } })
      expect(ops).toContainEqual({ value: 2, attributes: { cache: 'pages', cache_state: 'miss' } })
    })

    it('skips the operations counter for an object with no hit/total counters', async () => {
      cacheDiagnostics.trackCache('weird', fakeCache([{ itemCount: 5 }]))

      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_operations_total')).toHaveLength(0)
      expect(dataPointsIn(result, 'io_app_cache_items_current')).toEqual([
        { value: 5, attributes: { cache: 'weird' } },
      ])
    })

    it('stops reporting a cache once its disposer is called', async () => {
      const dispose = cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1 }]))

      dispose()
      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_operations_total')).toHaveLength(0)
    })

    it('does not publish hitRate, which a real cache does report', async () => {
      const cache = new LRUCache<string, number>({ max: 10 })
      cache.set('a', 1)
      cache.get('a')
      cache.get('absent')
      expect(cache.getStats().hitRate).toBe(0.5) // the legacy read has it...
      cacheDiagnostics.trackCache('pages', cache)

      const result = await reader.collect()

      // ...and it is deliberately not republished: derive it from the operations counter.
      expect(allMetricNamesIn(result)).not.toEqual(expect.arrayContaining([expect.stringMatching(/hit.?rate/i)]))
    })

    it('never creates an observable instrument in an app that registers none', async () => {
      // Spied before construction: this has to cover initialization too, not just the
      // push-based calls, or the "inert if unused" guarantee isn't actually tested.
      const createObservableGaugeSpy = jest.spyOn(cacheMetricsClient, 'createObservableGauge')
      const createObservableCounterSpy = jest.spyOn(cacheMetricsClient, 'createObservableCounter')
      ;(getMetricClient as jest.Mock).mockResolvedValue(cacheMetricsClient)

      const pushOnly = new DiagnosticsMetrics()
      await new Promise(resolve => setTimeout(resolve, 10))
      pushOnly.incrementCounter('unrelated_total', 1)
      pushOnly.setGauge('unrelated_current', 1)
      pushOnly.recordLatency(1, { operation: 'x' })

      expect(createObservableGaugeSpy).not.toHaveBeenCalled()
      expect(createObservableCounterSpy).not.toHaveBeenCalled()
    })

    it('recovers from a cache whose read throws, without dropping other caches', async () => {
      const throwingCache: TrackedCache = {
        getCumulativeStats: () => {
          throw new Error('boom')
        },
      }
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const disposeBroken = cacheDiagnostics.trackCache('broken', throwingCache)
      cacheDiagnostics.trackCache('pages', fakeCache([{ hits: 1, total: 1 }]))

      const result = await reader.collect()

      expect(dataPointsIn(result, 'io_app_cache_operations_total')).toContainEqual({
        attributes: { cache: 'pages', cache_state: 'hit' },
        value: 1,
      })
      expect(errorSpy).toHaveBeenCalled()

      disposeBroken() // avoid a second throw during afterEach's shutdown-triggered collect
      errorSpy.mockRestore()
    })
  })
})

import { Metrics, Types } from '@vtex/diagnostics-nodejs'
import { context, ObservableCallback } from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { LRUCache } from '../caches/LRUCache'
import { CumulativeStats } from '../caches/typings'
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

    it('should handle initialization errors gracefully', async () => {
      // Mock the getMetricClient (which is a Jest mock) to return an error
      const error = new Error('Initialization failed')
      ;(getMetricClient as jest.Mock).mockRejectedValueOnce(error)

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Create new instance that will fail initialization
      const failingMetrics = new DiagnosticsMetrics()
      
      // Wait for initialization attempt (async operation in constructor)
      await new Promise(resolve => setTimeout(resolve, 10))

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize metric client:', error)

      consoleErrorSpy.mockRestore()
    })

    it('should handle metric client initialization timeout', async () => {
      // Mock getMetricClient to never resolve
      ;(getMetricClient as jest.Mock).mockReturnValueOnce(
        new Promise(() => {}) // Never resolves
      )

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const timeoutMetrics = new DiagnosticsMetrics()
      
      // Wait for timeout (METRIC_CLIENT_INIT_TIMEOUT_MS should be defined in constants)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have logged timeout error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize metric client:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('should cache the initialization promise to prevent multiple initializations', async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Multiple calls should return the same promise
      const result1 = diagnosticsMetrics['initMetricClient']()
      const result2 = diagnosticsMetrics['initMetricClient']()
      
      expect(result1).toBe(result2)
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

    it('should handle hrtime with zero nanoseconds', () => {
      const hrtimeDiff: [number, number] = [5, 0]

      diagnosticsMetrics.recordLatency(hrtimeDiff)

      expect(recordedHistogramCalls[0].value).toBe(5000)
    })

    it('should handle hrtime with large nanoseconds value', () => {
      const hrtimeDiff: [number, number] = [0, 999999999]

      diagnosticsMetrics.recordLatency(hrtimeDiff)

      expect(recordedHistogramCalls[0].value).toBeCloseTo(999.999999, 4)
    })

    it('should handle zero milliseconds', () => {
      diagnosticsMetrics.recordLatency(0)

      expect(recordedHistogramCalls[0].value).toBe(0)
    })

    it('should handle negative milliseconds', () => {
      diagnosticsMetrics.recordLatency(-10)

      expect(recordedHistogramCalls[0].value).toBe(-10)
    })

    it('should handle very large millisecond values', () => {
      const largeValue = 999999999.999

      diagnosticsMetrics.recordLatency(largeValue)

      expect(recordedHistogramCalls[0].value).toBe(largeValue)
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

    it('should handle zero increment value', () => {
      diagnosticsMetrics.incrementCounter('test', 0)

      const calls = recordedCounterCalls.get('test')
      expect(calls![0].value).toBe(0)
    })

    it('should handle negative increment value', () => {
      diagnosticsMetrics.incrementCounter('test', -5)

      const calls = recordedCounterCalls.get('test')
      expect(calls![0].value).toBe(-5)
    })

    it('should handle very large increment values', () => {
      const largeValue = Number.MAX_SAFE_INTEGER
      diagnosticsMetrics.incrementCounter('test', largeValue)

      const calls = recordedCounterCalls.get('test')
      expect(calls![0].value).toBe(largeValue)
    })

    it('should handle empty counter name', () => {
      diagnosticsMetrics.incrementCounter('', 1)

      const calls = recordedCounterCalls.get('')
      expect(calls).toHaveLength(1)
      expect(calls![0].value).toBe(1)
    })

    it('should handle counter names with special characters', () => {
      diagnosticsMetrics.incrementCounter('counter:with:colons', 1)
      diagnosticsMetrics.incrementCounter('counter/with/slashes', 1)
      diagnosticsMetrics.incrementCounter('counter-with-dashes', 1)

      expect(recordedCounterCalls.get('counter:with:colons')).toHaveLength(1)
      expect(recordedCounterCalls.get('counter/with/slashes')).toHaveLength(1)
      expect(recordedCounterCalls.get('counter-with-dashes')).toHaveLength(1)
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

    it('should handle zero gauge value', () => {
      diagnosticsMetrics.setGauge('test', 0)

      const calls = recordedGaugeCalls.get('test')
      expect(calls![0].value).toBe(0)
    })

    it('should handle negative gauge values', () => {
      diagnosticsMetrics.setGauge('test', -100)

      const calls = recordedGaugeCalls.get('test')
      expect(calls![0].value).toBe(-100)
    })

    it('should handle very large gauge values', () => {
      const largeValue = Number.MAX_SAFE_INTEGER
      diagnosticsMetrics.setGauge('test', largeValue)

      const calls = recordedGaugeCalls.get('test')
      expect(calls![0].value).toBe(largeValue)
    })

    it('should handle very small (fractional) gauge values', () => {
      diagnosticsMetrics.setGauge('test', 0.0001)

      const calls = recordedGaugeCalls.get('test')
      expect(calls![0].value).toBe(0.0001)
    })

    it('should handle empty gauge name', () => {
      diagnosticsMetrics.setGauge('', 100)

      const calls = recordedGaugeCalls.get('')
      expect(calls).toHaveLength(1)
      expect(calls![0].value).toBe(100)
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

    it('should handle extreme attribute count exceeding limit significantly', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const attributes: Record<string, string> = {}
      for (let i = 0; i < 50; i++) {
        attributes[`attr${i}`] = `value${i}`
      }

      diagnosticsMetrics.recordLatency(100, attributes)

      // Only first 7 should be kept
      const recorded = recordedHistogramCalls[0].attributes
      expect(Object.keys(recorded)).toHaveLength(7)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('50 custom attributes provided')
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

      it('should restore outer context after inner runWithBaseAttributes completes', () => {
        const outerBase = { account: 'outer-account', level: 'outer' }
        const innerBase = { account: 'inner-account', level: 'inner' }

        diagnosticsMetrics.runWithBaseAttributes(outerBase, () => {
          diagnosticsMetrics.recordLatency(100, { op: 'before-inner' })
          
          diagnosticsMetrics.runWithBaseAttributes(innerBase, () => {
            diagnosticsMetrics.recordLatency(101, { op: 'during-inner' })
          })
          
          diagnosticsMetrics.recordLatency(102, { op: 'after-inner' })
        })

        expect(recordedHistogramCalls).toHaveLength(3)
        // First call: outer context
        expect(recordedHistogramCalls[0].attributes).toEqual({
          account: 'outer-account',
          level: 'outer',
          op: 'before-inner',
        })
        // Second call: inner context (overrides outer)
        expect(recordedHistogramCalls[1].attributes).toEqual({
          account: 'inner-account',
          level: 'inner',
          op: 'during-inner',
        })
        // Third call: back to outer context
        expect(recordedHistogramCalls[2].attributes).toEqual({
          account: 'outer-account',
          level: 'outer',
          op: 'after-inner',
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

      it('should not count base attributes against the custom attribute limit', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        
        const baseAttributes = {
          base1: 'value1',
          base2: 'value2',
          base3: 'value3',
          base4: 'value4',
          base5: 'value5',
          base6: 'value6',
          base7: 'value7',
          base8: 'value8',
          base9: 'value9',
          base10: 'value10',
        }
        const customAttributes = {
          custom1: 'value1',
          custom2: 'value2',
          custom3: 'value3',
        }

        diagnosticsMetrics.runWithBaseAttributes(baseAttributes, () => {
          diagnosticsMetrics.recordLatency(100, customAttributes)
        })

        // All 10 base attributes + all 3 custom attributes = 13 total
        // No warning should be issued because only 3 custom attributes
        expect(warnSpy).not.toHaveBeenCalled()
        const recorded = recordedHistogramCalls[0].attributes
        expect(Object.keys(recorded)).toHaveLength(13)

        warnSpy.mockRestore()
      })
    })
  })

  describe('runWithBaseAttributes return values', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should return the result of a synchronous function', () => {
      const result = diagnosticsMetrics.runWithBaseAttributes({ test: 'value' }, () => {
        return 'sync-result'
      })

      expect(result).toBe('sync-result')
    })

    it('should return a Promise from an async function', async () => {
      const result = await diagnosticsMetrics.runWithBaseAttributes({ test: 'value' }, async () => {
        return 'async-result'
      })

      expect(result).toBe('async-result')
    })

    it('should propagate exceptions thrown in the function', () => {
      expect(() => {
        diagnosticsMetrics.runWithBaseAttributes({ test: 'value' }, () => {
          throw new Error('test error')
        })
      }).toThrow('test error')
    })

    it('should support returning complex objects', () => {
      const complexObject = { nested: { value: 42 }, array: [1, 2, 3] }
      const result = diagnosticsMetrics.runWithBaseAttributes({ test: 'value' }, () => {
        return complexObject
      })

      expect(result).toEqual(complexObject)
    })

    it('should support returning undefined', () => {
      const result = diagnosticsMetrics.runWithBaseAttributes({ test: 'value' }, () => {
        // implicitly return undefined
      })

      expect(result).toBeUndefined()
    })
  })

  describe('edge cases and boundary conditions', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should handle empty attributes object', () => {
      diagnosticsMetrics.recordLatency(100, {})
      expect(recordedHistogramCalls[0].attributes).toEqual({})
    })

    it('should handle attributes with null values', () => {
      diagnosticsMetrics.recordLatency(100, { key: null as any })
      expect(recordedHistogramCalls[0].attributes).toEqual({ key: null })
    })

    it('should handle attributes with boolean values', () => {
      diagnosticsMetrics.recordLatency(100, { success: true, failed: false })
      expect(recordedHistogramCalls[0].attributes).toEqual({ success: true, failed: false })
    })

    it('should handle attributes with numeric values', () => {
      diagnosticsMetrics.recordLatency(100, { status: 200, timeout: 5000 })
      expect(recordedHistogramCalls[0].attributes).toEqual({ status: 200, timeout: 5000 })
    })

    it('should handle attributes with empty string values', () => {
      diagnosticsMetrics.recordLatency(100, { operation: '', message: '' })
      expect(recordedHistogramCalls[0].attributes).toEqual({ operation: '', message: '' })
    })

    it('should handle undefined custom attributes with undefined base attributes', () => {
      diagnosticsMetrics.recordLatency(100)
      expect(recordedHistogramCalls[0].attributes).toBeUndefined()
    })

    it('should handle counter with very long name', () => {
      const longName = 'counter_' + 'a'.repeat(1000)
      diagnosticsMetrics.incrementCounter(longName, 1)
      const calls = recordedCounterCalls.get(longName)
      expect(calls).toHaveLength(1)
    })

    it('should handle gauge with very long name', () => {
      const longName = 'gauge_' + 'a'.repeat(1000)
      diagnosticsMetrics.setGauge(longName, 100)
      const calls = recordedGaugeCalls.get(longName)
      expect(calls).toHaveLength(1)
    })

    it('should handle multiple concurrent metric calls', async () => {
      await Promise.all([
        Promise.resolve(diagnosticsMetrics.recordLatency(10)),
        Promise.resolve(diagnosticsMetrics.incrementCounter('test1', 1)),
        Promise.resolve(diagnosticsMetrics.setGauge('gauge1', 50)),
        Promise.resolve(diagnosticsMetrics.recordLatency(20)),
        Promise.resolve(diagnosticsMetrics.incrementCounter('test2', 2)),
      ])

      expect(recordedHistogramCalls).toHaveLength(2)
      expect(recordedCounterCalls.get('test1')).toHaveLength(1)
      expect(recordedCounterCalls.get('test2')).toHaveLength(1)
      expect(recordedGaugeCalls.get('gauge1')).toHaveLength(1)
    })

    it('should handle NaN milliseconds in recordLatency', () => {
      diagnosticsMetrics.recordLatency(NaN)
      expect(recordedHistogramCalls[0].value).toBe(NaN)
    })

    it('should handle Infinity in recordLatency', () => {
      diagnosticsMetrics.recordLatency(Infinity)
      expect(recordedHistogramCalls[0].value).toBe(Infinity)
    })

    it('should handle negative Infinity in recordLatency', () => {
      diagnosticsMetrics.recordLatency(-Infinity)
      expect(recordedHistogramCalls[0].value).toBe(-Infinity)
    })
  })

  describe('integration scenarios', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    it('should track multiple metrics for a single operation', () => {
      const attributes = { operation: 'database_query', status: 'success' }
      
      const startTime = process.hrtime()
      // Simulate work
      const elapsed = process.hrtime(startTime)

      diagnosticsMetrics.recordLatency(elapsed, attributes)
      diagnosticsMetrics.incrementCounter('database_queries_total', 1, attributes)
      diagnosticsMetrics.setGauge('active_connections', 5, { connection_type: 'database' })

      expect(recordedHistogramCalls).toHaveLength(1)
      expect(recordedCounterCalls.get('database_queries_total')).toHaveLength(1)
      expect(recordedGaugeCalls.get('active_connections')).toHaveLength(1)
    })

    it('should handle repeated metric collection over time', () => {
      for (let i = 0; i < 100; i++) {
        diagnosticsMetrics.recordLatency(Math.random() * 1000, { operation: 'test' })
      }

      expect(recordedHistogramCalls).toHaveLength(100)
      recordedHistogramCalls.forEach(call => {
        expect(call.value).toBeGreaterThanOrEqual(0)
        expect(call.value).toBeLessThan(1000)
      })
    })

    it('should support mixing base and custom attributes across multiple metric types', () => {
      const baseAttrs = { account: 'acme', route: 'api.orders' }

      diagnosticsMetrics.runWithBaseAttributes(baseAttrs, () => {
        diagnosticsMetrics.recordLatency(100, { operation: 'create' })
        diagnosticsMetrics.incrementCounter('orders_created_total', 1, { status: 'success' })
        diagnosticsMetrics.setGauge('pending_orders', 42, { priority: 'high' })
      })

      const histogramAttrs = recordedHistogramCalls[0].attributes
      const counterAttrs = recordedCounterCalls.get('orders_created_total')![0].attributes
      const gaugeAttrs = recordedGaugeCalls.get('pending_orders')![0].attributes

      expect(histogramAttrs).toHaveProperty('account', 'acme')
      expect(counterAttrs).toHaveProperty('account', 'acme')
      expect(gaugeAttrs).toHaveProperty('account', 'acme')
    })
  })
})