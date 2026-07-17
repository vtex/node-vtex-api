import { HttpAgentSingleton } from '../../../HttpClient/middlewares/request/HttpAgentSingleton'
import { EnvMetric, trackStatus } from './statusTrack'

describe('trackStatus', () => {
  let consoleLogSpy: jest.SpyInstance
  let updateHttpAgentMetricsSpy: jest.SpyInstance
  let statusTrackMock: jest.Mock<EnvMetric[]>

  const sampleMetrics: EnvMetric[] = [
    { name: 'http-handler-foo', production: true, count: 3, mean: 10 },
    { name: 'http-client-bar', production: false, count: 1, mean: 5 },
  ]

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    updateHttpAgentMetricsSpy = jest
      .spyOn(HttpAgentSingleton, 'updateHttpAgentMetrics')
      .mockImplementation(() => undefined)

    statusTrackMock = jest.fn(() => sampleMetrics)
    global.metrics = { statusTrack: statusTrackMock } as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (global as any).metrics
  })

  it('emits no console.log entry containing type: metric/status', () => {
    trackStatus()

    const emittedMetricStatusLog = consoleLogSpy.mock.calls.some(([arg]) =>
      typeof arg === 'string' && arg.includes('metric/status')
    )
    expect(emittedMetricStatusLog).toBe(false)
    expect(consoleLogSpy).not.toHaveBeenCalled()
  })

  it('invokes global.metrics.statusTrack() exactly once so batches are still flushed', () => {
    trackStatus()

    expect(statusTrackMock).toHaveBeenCalledTimes(1)
  })

  it('invokes HttpAgentSingleton.updateHttpAgentMetrics() exactly once', () => {
    trackStatus()

    expect(updateHttpAgentMetricsSpy).toHaveBeenCalledTimes(1)
  })
})
