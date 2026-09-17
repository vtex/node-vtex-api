const mockInitializeTelemetry = jest.fn()
const mockGetServiceJSON = jest.fn()
const mockStartMaster = jest.fn()
const mockStartWorker = jest.fn()

jest.mock('./telemetry', () => ({
  initializeTelemetry: mockInitializeTelemetry,
}))

jest.mock('./loaders', () => ({
  getServiceJSON: mockGetServiceJSON,
}))

jest.mock('./master', () => ({
  startMaster: mockStartMaster,
}))

jest.mock('./worker', () => ({
  startWorker: mockStartWorker,
}))

jest.mock('cluster', () => ({
  isMaster: true,
}))

describe('startApp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInitializeTelemetry.mockResolvedValue({})
    mockGetServiceJSON.mockReturnValue({})
  })

  it('initializes telemetry before starting the master/worker process', async () => {
    const { startApp } = require('./index')

    await startApp()

    // DiagnosticsMetrics's own constructor also triggers telemetry initialization via
    // getMetricClient(); the real TelemetryClientSingleton dedupes concurrent/repeat
    // calls, so we only assert it was called, not an exact count.
    expect(mockInitializeTelemetry).toHaveBeenCalled()
    expect(mockStartMaster).toHaveBeenCalledTimes(1)
    expect(mockInitializeTelemetry.mock.invocationCallOrder[0]).toBeLessThan(
      mockStartMaster.mock.invocationCallOrder[0]
    )
  })

  it('exposes global.diagnosticsMetrics after startup', async () => {
    const { startApp } = require('./index')

    await startApp()

    expect(global.diagnosticsMetrics).toBeDefined()
    expect(typeof global.diagnosticsMetrics.recordLatency).toBe('function')
  })
})
