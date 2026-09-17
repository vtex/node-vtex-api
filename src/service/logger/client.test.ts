const mockGetTelemetryClient = jest.fn()
const mockCreateExporter = jest.fn()
const mockCreateLogsExporterConfig = jest.fn()

jest.mock('@vtex/diagnostics-nodejs', () => ({
  Exporters: {
    CreateExporter: mockCreateExporter,
    CreateLogsExporterConfig: mockCreateLogsExporterConfig,
  },
}))

jest.mock('../telemetry', () => ({
  getTelemetryClient: mockGetTelemetryClient,
}))

describe('logger client', () => {
  const logsClient = {}
  const logsExporter = { initialize: jest.fn().mockResolvedValue(undefined) }
  const telemetryClient = { newLogsClient: jest.fn().mockResolvedValue(logsClient) }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    mockGetTelemetryClient.mockResolvedValue(telemetryClient)
    mockCreateLogsExporterConfig.mockReturnValue({ signal: 'logs' })
    mockCreateExporter.mockReturnValue(logsExporter)
  })

  it('builds a per-call logger name from account, workspace, and app name', async () => {
    const { getLogClient } = require('./client')

    const client = await getLogClient('myaccount', 'myworkspace', 'my-app')

    expect(telemetryClient.newLogsClient).toHaveBeenCalledWith(
      expect.objectContaining({ loggerName: 'node-vtex-api-myaccount-myworkspace-my-app' })
    )
    expect(client).toBe(logsClient)
  })

  it('sources the underlying telemetry client from the split telemetry module', async () => {
    const { getLogClient } = require('./client')

    await getLogClient('acc', 'ws', 'app')

    expect(mockGetTelemetryClient).toHaveBeenCalled()
  })

  it('caches the logs client across calls', async () => {
    const { getLogClient } = require('./client')

    await getLogClient('acc', 'ws', 'app')
    await getLogClient('acc', 'ws', 'app')

    expect(telemetryClient.newLogsClient).toHaveBeenCalledTimes(1)
  })
})
