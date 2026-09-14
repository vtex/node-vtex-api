import * as aggregator from '../../metrics/clusterMetricsAggregator'
import { AGG_METRICS_RES } from '../../metrics/clusterMetricsAggregator'
import { onMessage } from '../index'

describe('worker onMessage', () => {
  const handle = onMessage({} as any)

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('routes aggregate metric responses from the master to the aggregation handler', () => {
    const spy = jest.spyOn(aggregator, 'handleMasterMetricsResponse').mockReturnValue(undefined)
    const message = { body: 'AGGREGATED', id: 1, type: AGG_METRICS_RES }

    handle(message)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(message)
  })

  it('ignores prom-client cluster protocol messages without invoking the handler', () => {
    const spy = jest.spyOn(aggregator, 'handleMasterMetricsResponse')

    expect(() => handle({ type: 'prom-client:getMetricsRes' })).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
})
