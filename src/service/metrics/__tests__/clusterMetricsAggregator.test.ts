import { AggregatorRegistry, Counter, Registry } from 'prom-client'

import {
  __resetForTests,
  AGG_METRICS_REQ,
  AGG_METRICS_RES,
  AggMetricsResMessage,
  ensureWorkerAggregatorRegistry,
  handleMasterMetricsResponse,
  handleWorkerMetricsRequest,
  initMasterAggregatorRegistry,
  isAggMetricsRequest,
  isAggMetricsResponse,
  isPromClientMessage,
  requestAggregatedMetrics,
} from '../clusterMetricsAggregator'

const REQUESTS_TOTAL = {
  help: 'The total number of HTTP requests.',
  labelNames: ['status_code', 'handler'],
  name: 'runtime_http_requests_total',
}

// Build an isolated registry that mimics one worker's default registry with a
// runtime_http_requests_total counter incremented `count` times.
const buildWorkerRegistry = (count: number, labels = { handler: 'render', status_code: '200' }) => {
  const registry = new Registry()
  const counter = new Counter({ ...REQUESTS_TOTAL, registers: [registry] })
  for (let i = 0; i < count; i++) {
    counter.inc(labels)
  }
  return registry
}

// Parse `runtime_http_requests_total{...} <value>` samples out of exposition text.
const parseSeries = (text: string, metric: string): Record<string, number> => {
  const out: Record<string, number> = {}
  text
    .split('\n')
    .filter((line) => line.startsWith(metric) && !line.startsWith('# '))
    .forEach((line) => {
      const match = line.match(/^(\S+)\s+([\d.eE+-]+)$/)
      if (match) {
        out[match[1]] = Number(match[2])
      }
    })
  return out
}

const aggregateRegistries = async (registries: Array<Registry>): Promise<string> => {
  const jsons = await Promise.all(registries.map((r) => r.getMetricsAsJSON()))
  const merged = AggregatorRegistry.aggregate(jsons)
  return merged.metrics()
}

describe('clusterMetricsAggregator', () => {
  afterEach(() => {
    __resetForTests()
    jest.useRealTimers()
    delete (process as any).send
  })

  describe('registry lifecycle', () => {
    it('creates the master aggregator registry once (idempotent)', () => {
      const first = initMasterAggregatorRegistry()
      const second = initMasterAggregatorRegistry()
      expect(first).toBeInstanceOf(AggregatorRegistry)
      expect(second).toBe(first)
    })

    it('creates the worker aggregator registry once (idempotent)', () => {
      const first = ensureWorkerAggregatorRegistry()
      const second = ensureWorkerAggregatorRegistry()
      expect(first).toBeInstanceOf(AggregatorRegistry)
      expect(second).toBe(first)
    })
  })

  describe('message guards', () => {
    it('recognizes aggregate request/response and prom-client messages', () => {
      expect(isAggMetricsRequest({ id: 1, type: AGG_METRICS_REQ })).toBe(true)
      expect(isAggMetricsRequest({ type: AGG_METRICS_REQ })).toBe(false)
      expect(isAggMetricsResponse({ body: 'x', id: 1, type: AGG_METRICS_RES })).toBe(true)
      expect(isAggMetricsResponse('UP')).toBe(false)
      expect(isPromClientMessage({ type: 'prom-client:getMetricsReq' })).toBe(true)
      expect(isPromClientMessage({ type: 'prom-client:getMetricsRes' })).toBe(true)
      expect(isPromClientMessage('UP')).toBe(false)
      expect(isPromClientMessage({ statusTrack: true })).toBe(false)
    })
  })

  describe('aggregation across workers', () => {
    // AC2: a counter incremented once per worker in N workers reports N.
    it('sums a series across N workers', async () => {
      const N = 4
      const registries = Array.from({ length: N }, () => buildWorkerRegistry(1))
      const output = await aggregateRegistries(registries)
      const series = parseSeries(output, 'runtime_http_requests_total')
      const key = Object.keys(series).find((k) => k.includes('runtime_http_requests_total'))!
      expect(series[key]).toBe(N)
    })

    it('sums differing per-worker counts', async () => {
      const registries = [buildWorkerRegistry(5), buildWorkerRegistry(10), buildWorkerRegistry(2), buildWorkerRegistry(8)]
      const output = await aggregateRegistries(registries)
      const series = parseSeries(output, 'runtime_http_requests_total')
      const key = Object.keys(series).find((k) => k.includes('runtime_http_requests_total'))!
      expect(series[key]).toBe(25)
    })

    it('preserves and sums distinct label sets from different workers', async () => {
      const registries = [
        buildWorkerRegistry(3, { handler: 'render', status_code: '200' }),
        buildWorkerRegistry(4, { handler: 'render', status_code: '500' }),
        buildWorkerRegistry(1, { handler: 'render', status_code: '200' }),
      ]
      const output = await aggregateRegistries(registries)
      const series = parseSeries(output, 'runtime_http_requests_total')
      const ok = Object.keys(series).find((k) => k.includes('status_code="200"'))!
      const err = Object.keys(series).find((k) => k.includes('status_code="500"'))!
      expect(series[ok]).toBe(4)
      expect(series[err]).toBe(4)
    })

    // AC1: two consecutive scrapes never show a decreasing value, regardless of
    // which worker answers (the merge is the same aggregate either way).
    it('never decreases across two consecutive scrapes', async () => {
      const workerCounts = [5, 10, 2, 8]
      const registriesScrape1 = workerCounts.map((c) => buildWorkerRegistry(c))
      const scrape1 = parseSeries(await aggregateRegistries(registriesScrape1), 'runtime_http_requests_total')

      // Between scrapes each worker serves more traffic; counters only grow.
      const registriesScrape2 = workerCounts.map((c, i) => buildWorkerRegistry(c + i + 1))
      const scrape2 = parseSeries(await aggregateRegistries(registriesScrape2), 'runtime_http_requests_total')

      Object.keys(scrape1).forEach((key) => {
        expect(scrape2[key]).toBeGreaterThanOrEqual(scrape1[key])
      })
    })

    // AC4: default process metrics remain present in the aggregated output.
    it('includes default process metrics collected per worker', async () => {
      const registryWithDefaults = new Registry()
      // Emulate a default metric present in a worker registry.
      const cpu = new Counter({
        help: 'Total user and system CPU time spent in seconds.',
        name: 'process_cpu_seconds_total',
        registers: [registryWithDefaults],
      })
      cpu.inc(1)
      const output = await aggregateRegistries([registryWithDefaults, buildWorkerRegistry(1)])
      expect(output).toContain('process_cpu_seconds_total')
    })
  })

  describe('worker IPC request/response', () => {
    it('sends AGG_METRICS_REQ and resolves with the master body', async () => {
      const sent: any[] = []
      ;(process as any).send = (msg: any) => sent.push(msg)

      const promise = requestAggregatedMetrics()

      expect(sent).toHaveLength(1)
      expect(sent[0].type).toBe(AGG_METRICS_REQ)
      const { id } = sent[0]

      handleMasterMetricsResponse({ body: 'AGGREGATED_BODY', id, type: AGG_METRICS_RES })
      await expect(promise).resolves.toBe('AGGREGATED_BODY')
    })

    it('falls back to the local registry on timeout', async () => {
      jest.useFakeTimers()
      ;(process as any).send = () => undefined

      const promise = requestAggregatedMetrics()
      jest.advanceTimersByTime(6000)
      const body = await promise
      // Local register.metrics() output; just assert it is a (possibly empty) string.
      expect(typeof body).toBe('string')
    })

    it('falls back to the local registry when the master replies with an error', async () => {
      const sent: any[] = []
      ;(process as any).send = (msg: any) => sent.push(msg)

      const promise = requestAggregatedMetrics()
      const { id } = sent[0]
      const errorMsg: AggMetricsResMessage = { error: 'boom', id, type: AGG_METRICS_RES }
      handleMasterMetricsResponse(errorMsg)
      const body = await promise
      expect(typeof body).toBe('string')
    })

    it('ignores responses with unknown correlation ids', () => {
      expect(() => handleMasterMetricsResponse({ body: 'x', id: 9999, type: AGG_METRICS_RES })).not.toThrow()
    })

    it('serves local metrics when process.send is unavailable', async () => {
      delete (process as any).send
      const body = await requestAggregatedMetrics()
      expect(typeof body).toBe('string')
    })

    it('falls back to the local registry when process.send throws', async () => {
      ;(process as any).send = () => {
        throw new Error('ipc channel closed')
      }
      const body = await requestAggregatedMetrics()
      expect(typeof body).toBe('string')
    })
  })

  describe('master request handler', () => {
    it('replies to the requesting worker with a body', async () => {
      const worker: any = { send: jest.fn() }
      await handleWorkerMetricsRequest(worker, { id: 7, type: AGG_METRICS_REQ })
      expect(worker.send).toHaveBeenCalledTimes(1)
      const reply = worker.send.mock.calls[0][0]
      expect(reply.type).toBe(AGG_METRICS_RES)
      expect(reply.id).toBe(7)
      // No cluster workers in the test process → prom-client aggregates to ''.
      expect(typeof reply.body).toBe('string')
    })

    it('replies with an error when the cluster aggregation fails', async () => {
      const clusterMetricsSpy = jest
        .spyOn(AggregatorRegistry.prototype, 'clusterMetrics')
        .mockRejectedValue(new Error('collection failed'))
      const worker: any = { send: jest.fn() }

      await handleWorkerMetricsRequest(worker, { id: 3, type: AGG_METRICS_REQ })

      expect(clusterMetricsSpy).toHaveBeenCalledTimes(1)
      const reply = worker.send.mock.calls[0][0]
      expect(reply.type).toBe(AGG_METRICS_RES)
      expect(reply.id).toBe(3)
      expect(reply.error).toBe('collection failed')
      expect(reply.body).toBeUndefined()

      clusterMetricsSpy.mockRestore()
    })
  })
})
