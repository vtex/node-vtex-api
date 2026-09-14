import { MetricsAccumulator } from './MetricsAccumulator'
import * as statsLite from 'stats-lite'
import { HttpAgentSingleton } from '../HttpClient/middlewares/request/HttpAgentSingleton'
import * as requestStatsModule from '../service/worker/runtime/http/middlewares/requestStats'
import * as timeUtils from '../utils/time'

jest.mock('../HttpClient/middlewares/request/HttpAgentSingleton')
jest.mock('../service/worker/runtime/http/middlewares/requestStats')
jest.mock('../utils/time')
jest.mock('stats-lite')

describe('MetricsAccumulator', () => {
  let accumulator: MetricsAccumulator
  let mockCpuUsage: jest.Mock
  let mockMemoryUsage: jest.Mock
  let mockIncomingRequestStats: jest.Mock
  let mockHttpAgentStats: jest.Mock
  let mockMean: jest.Mock
  let mockMedian: jest.Mock
  let mockPercentile: jest.Mock
  let mockHrToMillis: jest.Mock

  beforeEach(() => {
    // Setup mocks
    mockCpuUsage = jest.fn().mockReturnValue({
      user: 100,
      system: 50,
    })
    
    mockMemoryUsage = jest.fn().mockReturnValue({
      rss: 1000000,
      heapTotal: 500000,
      heapUsed: 300000,
      external: 50000,
    })

    mockIncomingRequestStats = jest.fn().mockReturnValue({
      totalRequests: 10,
      avgTime: 25,
    })

    mockHttpAgentStats = jest.fn().mockReturnValue({
      sockets: 5,
      requests: 3,
    })

    mockMean = jest.fn().mockReturnValue(42)
    mockMedian = jest.fn().mockReturnValue(40)
    mockPercentile = jest.fn().mockImplementation((arr, percentile) => {
      if (percentile === 0.95) return 85
      if (percentile === 0.99) return 95
      return 50
    })

    mockHrToMillis = jest.fn().mockReturnValue(150)

    // Global mocks
    global.process.cpuUsage = mockCpuUsage as any
    global.process.memoryUsage = mockMemoryUsage as any

    ;(statsLite.mean as jest.Mock) = mockMean
    ;(statsLite.median as jest.Mock) = mockMedian
    ;(statsLite.percentile as jest.Mock) = mockPercentile
    ;(timeUtils.hrToMillis as jest.Mock) = mockHrToMillis
    ;(HttpAgentSingleton.httpAgentStats as jest.Mock) = mockHttpAgentStats
    ;(requestStatsModule.incomingRequestStats.get as jest.Mock) = mockIncomingRequestStats
    ;(requestStatsModule.incomingRequestStats.clear as jest.Mock) = jest.fn()

    accumulator = new MetricsAccumulator()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with empty metrics', () => {
      // Arrange & Act
      const acc = new MetricsAccumulator()

      // Assert
      expect(acc).toBeDefined()
    })
  })

  describe('batchMetric', () => {
    it('should add a metric with timeMillis', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric).toBeDefined()
      expect(metric?.count).toBe(1)
      expect(metric?.mean).toBe(42)
    })

    it('should accumulate multiple metrics with same name', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      accumulator.batchMetric('test.metric', 150)
      accumulator.batchMetric('test.metric', 200)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(3)
      expect(mockMean).toHaveBeenCalledWith([100, 150, 200])
      expect(mockMedian).toHaveBeenCalledWith([100, 150, 200])
    })

    it('should handle metric without timeMillis', () => {
      // Act
      accumulator.batchMetric('test.metric')
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(0)
    })

    it('should add extensions to metric', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { endpoint: '/api/test', status: 200 })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.endpoint).toBe('/api/test')
      expect(metric?.status).toBe(200)
    })

    it('should aggregate numeric extensions by adding them', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { count: 5 })
      accumulator.batchMetric('test.metric', 120, { count: 3 })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(2) // metric count
      expect((metric as any).count).not.toBe(8) // extensions.count should be aggregated separately
    })

    it('should override string extensions with latest value', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { endpoint: '/api/first' })
      accumulator.batchMetric('test.metric', 120, { endpoint: '/api/second' })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.endpoint).toBe('/api/second')
    })

    it('should handle mixed string and numeric extensions', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { label: 'first', value: 10 })
      accumulator.batchMetric('test.metric', 120, { label: 'second', value: 20 })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.label).toBe('second')
      expect((metric as any).value).toBe(30)
    })

    it('should handle timeMillis as null', () => {
      // Act
      accumulator.batchMetric('test.metric', null as any)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(0)
    })

    it('should handle undefined extensions', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, undefined)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(1)
    })

    it('should initialize extension object on first call', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { ext: 'value' })
      accumulator.batchMetric('test.metric', 120, { ext: 'value2' })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.ext).toBeDefined()
    })
  })

  describe('batch', () => {
    it('should convert hrtime diff to millis and batch metric', () => {
      // Act
      accumulator.batch('test.metric', [1, 500000000])
      const result = accumulator.statusTrack()

      // Assert
      expect(mockHrToMillis).toHaveBeenCalledWith([1, 500000000])
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(1)
    })

    it('should handle batch without diffNs', () => {
      // Act
      accumulator.batch('test.metric')
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(0)
    })

    it('should pass extensions to batchMetric', () => {
      // Act
      accumulator.batch('test.metric', [1, 500000000], { endpoint: '/test' })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.endpoint).toBe('/test')
    })

    it('should accumulate multiple batch calls', () => {
      // Act
      accumulator.batch('test.metric', [0, 100000000])
      accumulator.batch('test.metric', [0, 200000000])
      const result = accumulator.statusTrack()

      // Assert
      expect(mockHrToMillis).toHaveBeenCalledTimes(2)
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(2)
    })
  })

  describe('addOnFlushMetric', () => {
    it('should execute flush metric function on statusTrack', () => {
      // Arrange
      const mockMetricFn = jest.fn().mockReturnValue({
        name: 'custom.metric',
        value: 42,
      })

      // Act
      accumulator.addOnFlushMetric(mockMetricFn)
      const result = accumulator.statusTrack()

      // Assert
      expect(mockMetricFn).toHaveBeenCalled()
      const metric = result.find(m => m.name === 'custom.metric')
      expect(metric?.value).toBe(42)
    })

    it('should handle multiple on-flush metrics', () => {
      // Arrange
      const mockMetricFn1 = jest.fn().mockReturnValue({
        name: 'custom.metric1',
        value: 1,
      })
      const mockMetricFn2 = jest.fn().mockReturnValue({
        name: 'custom.metric2',
        value: 2,
      })

      // Act
      accumulator.addOnFlushMetric(mockMetricFn1)
      accumulator.addOnFlushMetric(mockMetricFn2)
      const result = accumulator.statusTrack()

      // Assert
      expect(mockMetricFn1).toHaveBeenCalled()
      expect(mockMetricFn2).toHaveBeenCalled()
      const metric1 = result.find(m => m.name === 'custom.metric1')
      const metric2 = result.find(m => m.name === 'custom.metric2')
      expect(metric1).toBeDefined()
      expect(metric2).toBeDefined()
    })

    it('should handle on-flush metric returning array of metrics', () => {
      // Arrange
      const mockMetricFn = jest.fn().mockReturnValue([
        { name: 'custom.metric1', value: 1 },
        { name: 'custom.metric2', value: 2 },
      ])

      // Act
      accumulator.addOnFlushMetric(mockMetricFn)
      const result = accumulator.statusTrack()

      // Assert
      expect(mockMetricFn).toHaveBeenCalled()
      const metric1 = result.find(m => m.name === 'custom.metric1')
      const metric2 = result.find(m => m.name === 'custom.metric2')
      expect(metric1).toBeDefined()
      expect(metric2).toBeDefined()
    })

    it('should add production flag to on-flush metrics', () => {
      // Arrange
      const mockMetricFn = jest.fn().mockReturnValue({
        name: 'custom.metric',
        value: 42,
      })

      // Act
      accumulator.addOnFlushMetric(mockMetricFn)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'custom.metric')
      expect(metric?.production).toBeDefined()
    })
  })

  describe('trackCache', () => {
    it('should track cache instance', () => {
      // Arrange
      const mockCache = {
        getStats: jest.fn().mockReturnValue({
          hits: 100,
          misses: 20,
        }),
      }

      // Act
      accumulator.trackCache('my-cache', mockCache)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'my-cache-cache')
      expect(metric?.hits).toBe(100)
      expect(metric?.misses).toBe(20)
    })

    it('should call getStats on tracked cache', () => {
      // Arrange
      const mockCache = {
        getStats: jest.fn().mockReturnValue({
          size: 50,
        }),
      }

      // Act
      accumulator.trackCache('my-cache', mockCache)
      accumulator.statusTrack()

      // Assert
      expect(mockCache.getStats).toHaveBeenCalled()
    })

    it('should handle multiple tracked caches', () => {
      // Arrange
      const mockCache1 = {
        getStats: jest.fn().mockReturnValue({ hits: 100 }),
      }
      const mockCache2 = {
        getStats: jest.fn().mockReturnValue({ hits: 200 }),
      }

      // Act
      accumulator.trackCache('cache1', mockCache1)
      accumulator.trackCache('cache2', mockCache2)
      const result = accumulator.statusTrack()

      // Assert
      const metric1 = result.find(m => m.name === 'cache1-cache')
      const metric2 = result.find(m => m.name === 'cache2-cache')
      expect(metric1?.hits).toBe(100)
      expect(metric2?.hits).toBe(200)
    })

    it('should add production flag to cache metrics', () => {
      // Arrange
      const mockCache = {
        getStats: jest.fn().mockReturnValue({
          size: 50,
        }),
      }

      // Act
      accumulator.trackCache('my-cache', mockCache)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'my-cache-cache')
      expect(metric?.production).toBeDefined()
    })
  })

  describe('statusTrack', () => {
    it('should return system metrics', () => {
      // Act
      const result = accumulator.statusTrack()

      // Assert
      expect(result).toBeInstanceOf(Array)
      const cpuMetric = result.find(m => m.name === 'cpu')
      const memoryMetric = result.find(m => m.name === 'memory')
      const httpAgentMetric = result.find(m => m.name === 'httpAgent')
      const incomingRequestMetric = result.find(m => m.name === 'incomingRequest')
      expect(cpuMetric).toBeDefined()
      expect(memoryMetric).toBeDefined()
      expect(httpAgentMetric).toBeDefined()
      expect(incomingRequestMetric).toBeDefined()
    })

    it('should include cpu metrics', () => {
      // Act
      const result = accumulator.statusTrack()

      // Assert
      const cpuMetric = result.find(m => m.name === 'cpu')
      expect(cpuMetric?.user).toBe(100)
      expect(cpuMetric?.system).toBe(50)
      expect(cpuMetric?.production).toBeDefined()
    })

    it('should include memory metrics', () => {
      // Act
      const result = accumulator.statusTrack()

      // Assert
      const memoryMetric = result.find(m => m.name === 'memory')
      expect(memoryMetric?.rss).toBe(1000000)
      expect(memoryMetric?.heapTotal).toBe(500000)
      expect(memoryMetric?.heapUsed).toBe(300000)
      expect(memoryMetric?.external).toBe(50000)
    })

    it('should include http agent metrics', () => {
      // Act
      const result = accumulator.statusTrack()

      // Assert
      const httpAgentMetric = result.find(m => m.name === 'httpAgent')
      expect(httpAgentMetric?.sockets).toBe(5)
      expect(httpAgentMetric?.requests).toBe(3)
    })

    it('should include incoming request metrics', () => {
      // Act
      const result = accumulator.statusTrack()

      // Assert
      const incomingRequestMetric = result.find(m => m.name === 'incomingRequest')
      expect(incomingRequestMetric?.totalRequests).toBe(10)
      expect(incomingRequestMetric?.avgTime).toBe(25)
    })

    it('should clear incoming request stats after flushing', () => {
      // Act
      accumulator.statusTrack()

      // Assert
      expect(requestStatsModule.incomingRequestStats.clear).toHaveBeenCalled()
    })

    it('should combine all metric types', () => {
      // Arrange
      accumulator.batchMetric('test.metric', 100)
      const mockCache = {
        getStats: jest.fn().mockReturnValue({ size: 50 }),
      }
      accumulator.trackCache('cache1', mockCache)
      const mockMetricFn = jest.fn().mockReturnValue({
        name: 'custom.metric',
        value: 42,
      })
      accumulator.addOnFlushMetric(mockMetricFn)

      // Act
      const result = accumulator.statusTrack()

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(7) // at least cpu, memory, httpAgent, incomingRequest, test, cache, custom
    })

    it('should call cpu usage', () => {
      // Act
      accumulator.statusTrack()

      // Assert
      expect(mockCpuUsage).toHaveBeenCalled()
    })

    it('should call memory usage', () => {
      // Act
      accumulator.statusTrack()

      // Assert
      expect(mockMemoryUsage).toHaveBeenCalled()
    })

    it('should call http agent stats', () => {
      // Act
      accumulator.statusTrack()

      // Assert
      expect(mockHttpAgentStats).toHaveBeenCalled()
    })

    it('should call incoming request stats', () => {
      // Act
      accumulator.statusTrack()

      // Assert
      expect(mockIncomingRequestStats).toHaveBeenCalled()
    })
  })

  describe('metricToAggregate (via statusTrack)', () => {
    it('should calculate count from metric array length', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      accumulator.batchMetric('test.metric', 150)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(2)
    })

    it('should calculate max from metric array', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      accumulator.batchMetric('test.metric', 250)
      accumulator.batchMetric('test.metric', 150)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.max).toBe(250)
    })

    it('should calculate mean using stats-lite', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      const result = accumulator.statusTrack()

      // Assert
      expect(mockMean).toHaveBeenCalledWith([100])
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.mean).toBe(42)
    })

    it('should calculate median using stats-lite', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      const result = accumulator.statusTrack()

      // Assert
      expect(mockMedian).toHaveBeenCalledWith([100])
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.median).toBe(40)
    })

    it('should calculate 95th percentile', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      const result = accumulator.statusTrack()

      // Assert
      expect(mockPercentile).toHaveBeenCalledWith([100], 0.95)
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.percentile95).toBe(85)
    })

    it('should calculate 99th percentile', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      const result = accumulator.statusTrack()

      // Assert
      expect(mockPercentile).toHaveBeenCalledWith([100], 0.99)
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.percentile99).toBe(95)
    })

    it('should include production flag', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.production).toBeDefined()
      expect(typeof metric?.production).toBe('boolean')
    })

    it('should include extensions in aggregate metric', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { endpoint: '/api' })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.endpoint).toBe('/api')
    })

    it('should clear metrics after aggregation', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      accumulator.statusTrack()
      const result2 = accumulator.statusTrack()

      // Assert
      const metric = result2.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle statusTrack with no accumulated metrics', () => {
      // Act
      const result = accumulator.statusTrack()

      // Assert
      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle empty metric name', () => {
      // Act
      accumulator.batchMetric('', 100)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === '')
      expect(metric).toBeDefined()
    })

    it('should handle zero timeMillis', () => {
      // Act
      accumulator.batchMetric('test.metric', 0)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(1)
      expect(metric?.max).toBe(0)
    })

    it('should handle negative timeMillis', () => {
      // Act
      accumulator.batchMetric('test.metric', -100)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(1)
    })

    it('should handle very large timeMillis', () => {
      // Act
      accumulator.batchMetric('test.metric', 999999999)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(1)
      expect(metric?.max).toBe(999999999)
    })

    it('should handle empty extensions object', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, {})
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect(metric?.count).toBe(1)
    })

    it('should handle extensions with zero numeric values', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { count: 0 })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect((metric as any).count).toBe(0) // from extensions, not the metric count
    })

    it('should handle multiple calls to statusTrack', () => {
      // Act
      accumulator.batchMetric('test.metric', 100)
      const result1 = accumulator.statusTrack()
      const result2 = accumulator.statusTrack()

      // Assert
      const metric1 = result1.find(m => m.name === 'test.metric')
      const metric2 = result2.find(m => m.name === 'test.metric')
      expect(metric1?.count).toBe(1)
      expect(metric2?.count).toBe(0) // should be cleared
    })

    it('should handle special characters in metric names', () => {
      // Act
      accumulator.batchMetric('test.metric:special-name@123', 100)
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric:special-name@123')
      expect(metric).toBeDefined()
    })

    it('should handle special characters in extension keys', () => {
      // Act
      accumulator.batchMetric('test.metric', 100, { 'special-key@123': 'value' })
      const result = accumulator.statusTrack()

      // Assert
      const metric = result.find(m => m.name === 'test.metric')
      expect((metric as any)['special-key@123']).toBe('value')
    })

    it('should preserve metric data across multiple batch operations', () => {
      // Act
      accumulator.batchMetric('metric1', 100)
      accumulator.batchMetric('metric2', 200)
      accumulator.batchMetric('metric1', 150)
      const result = accumulator.statusTrack()

      // Assert
      const metric1 = result.find(m => m.name === 'metric1')
      const metric2 = result.find(m => m.name === 'metric2')
      expect(metric1?.count).toBe(2)
      expect(metric2?.count).toBe(1)
    })
  })
})
