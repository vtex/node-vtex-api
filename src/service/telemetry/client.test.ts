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
    VTEX_IO_CLUSTER_ID: 'vtex_io.cluster.id',
    VTEX_IO_CLUSTER_ROLE: 'vtex_io.cluster.role',
    VTEX_IO_WORKSPACE_NAME: 'vtex_io.workspace.name',
    VTEX_IO_WORKSPACE_TYPE: 'vtex_io.workspace.type',
  },
  CLUSTER_ID: 'cluster-a',
  CLUSTER_ROLE: 'stores',
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

import { getTelemetryClient, initializeTelemetry, resetTelemetry } from './client'

describe('telemetry client', () => {
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

    mockGetClusterResourceAttributes.mockReturnValue({
      'vtex_io.cluster.id': 'cluster-a',
      'vtex_io.cluster.role': 'stores',
    })
    mockCreateExporter.mockImplementation(config => config)
    mockCreateTracesExporterConfig.mockReturnValue({ signal: 'traces' })
    mockCreateMetricsExporterConfig.mockReturnValue({ signal: 'metrics' })
    mockCreateLogsExporterConfig.mockReturnValue({ signal: 'logs' })
    mockNewTelemetryClient.mockResolvedValue(telemetryClient)
    telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
    telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
    telemetryClient.newLogsClient.mockResolvedValue(logsClient)
  })

  describe('initializeTelemetry', () => {
    it('shares configured cluster resource attributes across metrics and logs', async () => {
      const clients = await initializeTelemetry()

      expect(mockGetClusterResourceAttributes).toHaveBeenCalledWith('cluster-a', 'stores')
      expect(mockNewTelemetryClient).toHaveBeenCalledWith(
        'apps-team',
        'node-vtex-api',
        'vtex.test-app@1.0.0',
        expect.objectContaining({
          additionalAttrs: expect.objectContaining({
            'vtex_io.cluster.id': 'cluster-a',
            'vtex_io.cluster.role': 'stores',
          }),
        })
      )
      expect(clients).toEqual({ tracesClient, metricsClient, logsClient })
    })

    it('initializes without cluster dimensions when metadata is unavailable', async () => {
      mockGetClusterResourceAttributes.mockReturnValue({})

      await initializeTelemetry()

      const options = mockNewTelemetryClient.mock.calls[0][3]
      expect(options.additionalAttrs).not.toHaveProperty('vtex_io.cluster.id')
      expect(options.additionalAttrs).not.toHaveProperty('vtex_io.cluster.role')
    })

    it('caches clients after the first successful initialization', async () => {
      await initializeTelemetry()
      await initializeTelemetry()

      expect(mockNewTelemetryClient).toHaveBeenCalledTimes(1)
    })

    it('shares a single in-flight initialization across concurrent callers', async () => {
      const [first, second] = await Promise.all([initializeTelemetry(), initializeTelemetry()])

      expect(mockNewTelemetryClient).toHaveBeenCalledTimes(1)
      expect(first).toBe(second)
    })

    it('re-initializes after reset', async () => {
      await initializeTelemetry()
      resetTelemetry()
      await initializeTelemetry()

      expect(mockNewTelemetryClient).toHaveBeenCalledTimes(2)
    })

    it('does not register instrumentations when telemetry is disabled', async () => {
      await initializeTelemetry()

      expect(telemetryClient.registerInstrumentations).not.toHaveBeenCalled()
    })
  })

  describe('when diagnostics telemetry is enabled', () => {
    beforeEach(() => {
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: 'vtex.test-app@1.0.0', VENDOR: 'vtex', VERSION: '1.0.0' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
          VTEX_IO_CLUSTER_ID: 'vtex_io.cluster.id',
          VTEX_IO_CLUSTER_ROLE: 'vtex_io.cluster.role',
          VTEX_IO_WORKSPACE_NAME: 'vtex_io.workspace.name',
          VTEX_IO_WORKSPACE_TYPE: 'vtex_io.workspace.type',
        },
        CLUSTER_ID: 'cluster-a',
        CLUSTER_ROLE: 'stores',
        DIAGNOSTICS_TELEMETRY_ENABLED: true,
        DK_APP_ID: 'apps-team',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector',
        PRODUCTION: true,
        WORKSPACE: 'master',
      }))
    })

    it('registers Koa and host-metrics instrumentation', async () => {
      const { initializeTelemetry: initializeTelemetryEnabled } = require('./client')

      await initializeTelemetryEnabled()

      expect(telemetryClient.registerInstrumentations).toHaveBeenCalledTimes(1)
      const [instrumentations] = telemetryClient.registerInstrumentations.mock.calls[0]
      expect(instrumentations.some((i: any) => i.constructor?.name === 'KoaInstrumentation')).toBe(true)
    })
  })

  describe('getTelemetryClient', () => {
    it('returns the raw underlying TelemetryClient used to build the split clients', async () => {
      const rawClient = await getTelemetryClient()

      expect(rawClient).toBe(telemetryClient)
    })

    it('reuses the same cached raw client as initializeTelemetry', async () => {
      await initializeTelemetry()
      const rawClient = await getTelemetryClient()

      expect(mockNewTelemetryClient).toHaveBeenCalledTimes(1)
      expect(rawClient).toBe(telemetryClient)
    })
  })
})
