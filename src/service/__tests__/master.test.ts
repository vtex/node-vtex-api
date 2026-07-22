import { Worker } from 'cluster'

import * as aggregator from '../metrics/clusterMetricsAggregator'
import { AGG_METRICS_REQ } from '../metrics/clusterMetricsAggregator'
import { onMessage } from '../master'

describe('master onMessage', () => {
  const worker = { process: { pid: 123 }, send: jest.fn() } as unknown as Worker

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('routes aggregate metric requests from workers to the aggregation handler', () => {
    const spy = jest.spyOn(aggregator, 'handleWorkerMetricsRequest').mockResolvedValue(undefined)
    const message = { id: 1, type: AGG_METRICS_REQ }

    onMessage(worker, message)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(worker, message)
  })

  it('ignores prom-client cluster protocol messages without invoking the handler', () => {
    const spy = jest.spyOn(aggregator, 'handleWorkerMetricsRequest')

    expect(() => onMessage(worker, { type: 'prom-client:getMetricsReq' })).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
})
