const mockNewTelemetryClient = jest.fn()
const mockCreateExporter = jest.fn()
const mockCreateTracesExporterConfig = jest.fn()
const mockCreateMetricsExporterConfig = jest.fn()
const mockCreateLogsExporterConfig = jest.fn()
const mockGetClusterResourceAttributes = jest.fn()

jest.mock('@vtex/diagnostics-nodejs', () => ({
  Exporters: {
    CreateExporter: mockCreateExporter,
    CreateLogsExporterConfig: mockCreateLogsExporterConfig,
    CreateMetricsExporterConfig: mockCreateMetricsExporterConfig,
    CreateTracesExporterConfig: mockCreateTracesExporterConfig,
  },
  Instrumentation: {
    CommonInstrumentations: {
      minimal: jest.fn(() => []),
    },
  },
  NewTelemetryClient: mockNewTelemetryClient,
}))

jest.mock('../../constants', () => ({
  APP: {
    ID: 'vtex.test-app@1.0.0',
    VENDOR: 'vtex',
    VERSION: '1.0.0',
  },
  AttributeKeys: {
    VTEX_IO_APP_ID: 'vtex_io.app.id',
    VTEX_IO_WORKSPACE_NAME: 'vtex_io.workspace.name',
    VTEX_IO_WORKSPACE_TYPE: 'vtex_io.workspace.type',
  },
  CLUSTER_ID: 'cluster-a',
  CLUSTER_ROLE: 'primary',
  DIAGNOSTICS_TELEMETRY_ENABLED: false,
  DK_APP_ID: 'apps-team',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector',
  PRODUCTION: true,
  WORKSPACE: 'master',
}))

jest.mock('../metrics/instruments/hostMetrics', () => ({
  HostMetricsInstrumentation: jest.fn(),
}))

jest.mock('./resourceAttributes', () => ({
  getClusterResourceAttributes: mockGetClusterResourceAttributes,
}))

import { initializeTelemetry, resetTelemetry } from './client'

describe('diagnostics telemetry resource attributes', () => {
  const tracesClient = {}
  const metricsClient = { provider: jest.fn() }
  const logsClient = {}
  const telemetryClient = {
    newLogsClient: jest.fn(),
    newMetricsClient: jest.fn(),
    newTracesClient: jest.fn(),
    registerInstrumentations: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    resetTelemetry()

    mockCreateExporter.mockImplementation(config => config)
    mockCreateTracesExporterConfig.mockReturnValue({ signal: 'traces' })
    mockCreateMetricsExporterConfig.mockReturnValue({ signal: 'metrics' })
    mockCreateLogsExporterConfig.mockReturnValue({ signal: 'logs' })
    mockNewTelemetryClient.mockResolvedValue(telemetryClient)
    telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
    telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
    telemetryClient.newLogsClient.mockResolvedValue(logsClient)
  })

  it('shares configured cluster resource attributes across metrics and logs', async () => {
    mockGetClusterResourceAttributes.mockReturnValue({
      cluster_id: 'cluster-a',
      cluster_role: 'primary',
    })

    const clients = await initializeTelemetry()

    expect(mockGetClusterResourceAttributes).toHaveBeenCalledWith('cluster-a', 'primary')
    expect(mockNewTelemetryClient).toHaveBeenCalledWith(
      'apps-team',
      'node-vtex-api',
      'vtex.test-app@1.0.0',
      expect.objectContaining({
        additionalAttrs: expect.objectContaining({
          cluster_id: 'cluster-a',
          cluster_role: 'primary',
        }),
      })
    )
    expect(telemetryClient.newMetricsClient).toHaveBeenCalledTimes(1)
    expect(telemetryClient.newLogsClient).toHaveBeenCalledTimes(1)
    expect(telemetryClient.newMetricsClient.mock.calls[0][0]).not.toHaveProperty('additionalAttrs')
    expect(telemetryClient.newLogsClient.mock.calls[0][0]).not.toHaveProperty('additionalAttrs')
    expect(clients).toEqual({ tracesClient, metricsClient, logsClient })
  })

  it('initializes without cluster dimensions when metadata is unavailable', async () => {
    mockGetClusterResourceAttributes.mockReturnValue({})

    await initializeTelemetry()

    const options = mockNewTelemetryClient.mock.calls[0][3]
    expect(options.additionalAttrs).not.toHaveProperty('cluster_id')
    expect(options.additionalAttrs).not.toHaveProperty('cluster_role')
    expect(telemetryClient.newMetricsClient).toHaveBeenCalledTimes(1)
    expect(telemetryClient.newLogsClient).toHaveBeenCalledTimes(1)
  })
})
