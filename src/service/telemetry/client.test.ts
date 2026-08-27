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
    VTEX_IO_CLUSTER_ID: 'vtex_io.cluster.id',
    VTEX_IO_CLUSTER_ROLE: 'vtex_io.cluster.role',
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
      'vtex_io.cluster.id': 'cluster-a',
      'vtex_io.cluster.role': 'stores',
    })

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
    expect(options.additionalAttrs).not.toHaveProperty('vtex_io.cluster.id')
    expect(options.additionalAttrs).not.toHaveProperty('vtex_io.cluster.role')
    expect(telemetryClient.newMetricsClient).toHaveBeenCalledTimes(1)
    expect(telemetryClient.newLogsClient).toHaveBeenCalledTimes(1)
  })
})

const mockNewTelemetryClient = jest.fn()
const mockCreateExporter = jest.fn()
const mockCreateTracesExporterConfig = jest.fn()
const mockCreateMetricsExporterConfig = jest.fn()
const mockCreateLogsExporterConfig = jest.fn()
const mockGetClusterResourceAttributes = jest.fn()

jest.mock('@opentelemetry/instrumentation-koa')

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
    VTEX_IO_CLUSTER_ID: 'vtex_io.cluster.id',
    VTEX_IO_CLUSTER_ROLE: 'vtex_io.cluster.role',
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

import { initializeTelemetry, resetTelemetry } from './client'
import { Instrumentation } from '@vtex/diagnostics-nodejs'
import { HostMetricsInstrumentation } from '../metrics/instruments/hostMetrics'

describe('TelemetryClientSingleton', () => {
  const tracesClient = { id: 'traces' }
  const metricsClient = { id: 'metrics', provider: jest.fn(() => ({ meterProvider: true })) }
  const logsClient = { id: 'logs' }
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
    mockGetClusterResourceAttributes.mockReturnValue({})
  })

  describe('initializeTelemetry', () => {
    it('returns telemetry clients on successful initialization', async () => {
      // Arrange & Act
      const clients = await initializeTelemetry()

      // Assert
      expect(clients).toEqual({ tracesClient, metricsClient, logsClient })
    })

    it('initializes telemetry client with correct parameters', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      expect(mockNewTelemetryClient).toHaveBeenCalledWith(
        'apps-team',
        'node-vtex-api',
        'vtex.test-app@1.0.0',
        expect.objectContaining({
          additionalAttrs: expect.objectContaining({
            'vtex_io.app.id': 'vtex.test-app@1.0.0',
            'vendor': 'vtex',
            'version': '1.0.0',
            'vtex_io.workspace.name': 'master',
            'vtex_io.workspace.type': 'production',
          }),
          noop: true,
        })
      )
    })

    it('sets noop to false when DIAGNOSTICS_TELEMETRY_ENABLED is true', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: 'vtex.test-app@1.0.0', VENDOR: 'vtex', VERSION: '1.0.0' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
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
      const { initializeTelemetry: initTelemetry2, resetTelemetry: resetTelemetry2 } =
        require('./client')
      resetTelemetry2()
      mockNewTelemetryClient.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      await initTelemetry2()

      // Assert
      const options = mockNewTelemetryClient.mock.calls[0][3]
      expect(options.noop).toBe(false)
      jest.resetModules()
    })

    it('initializes traces client with correct exporter config', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      expect(mockCreateTracesExporterConfig).toHaveBeenCalledWith({
        endpoint: 'http://collector',
      })
      expect(telemetryClient.newTracesClient).toHaveBeenCalledWith({
        exporter: { signal: 'traces' },
      })
    })

    it('initializes metrics client with correct exporter config', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      expect(mockCreateMetricsExporterConfig).toHaveBeenCalledWith({
        endpoint: 'http://collector',
        interval: 60,
        temporality: 'delta',
        timeoutSeconds: 60,
      })
      expect(telemetryClient.newMetricsClient).toHaveBeenCalledWith({
        exporter: { signal: 'metrics' },
      })
    })

    it('initializes logs client with correct exporter config and logger name', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      expect(mockCreateLogsExporterConfig).toHaveBeenCalledWith({
        endpoint: 'http://collector',
      })
      expect(telemetryClient.newLogsClient).toHaveBeenCalledWith({
        exporter: { signal: 'logs' },
        loggerName: 'node-vtex-api-vtex.test-app@1.0.0',
      })
    })

    it('uses APP.ID as APPLICATION_ID when available', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      const options = mockNewTelemetryClient.mock.calls[0][3]
      expect(options.additionalAttrs['vtex_io.app.id']).toBe('vtex.test-app@1.0.0')
      expect(telemetryClient.newLogsClient).toHaveBeenCalledWith(
        expect.objectContaining({ loggerName: 'node-vtex-api-vtex.test-app@1.0.0' })
      )
    })

    it('uses vtex-io-app as APPLICATION_ID when APP.ID is not available', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: undefined, VENDOR: 'vtex', VERSION: '1.0.0' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
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
      const { initializeTelemetry: initTelemetry3, resetTelemetry: resetTelemetry3 } =
        require('./client')
      resetTelemetry3()
      mockNewTelemetryClient.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      await initTelemetry3()

      // Assert
      expect(telemetryClient.newLogsClient).toHaveBeenCalledWith(
        expect.objectContaining({ loggerName: 'node-vtex-api-vtex-io-app' })
      )
      jest.resetModules()
    })

    it('includes cluster resource attributes when available', async () => {
      // Arrange
      mockGetClusterResourceAttributes.mockReturnValue({
        'vtex_io.cluster.id': 'cluster-a',
        'vtex_io.cluster.role': 'stores',
      })

      // Act
      await initializeTelemetry()

      // Assert
      const options = mockNewTelemetryClient.mock.calls[0][3]
      expect(options.additionalAttrs).toMatchObject({
        'vtex_io.cluster.id': 'cluster-a',
        'vtex_io.cluster.role': 'stores',
      })
    })

    it('handles empty string APP.VERSION', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: 'vtex.test-app@1.0.0', VENDOR: 'vtex', VERSION: '' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
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
      const { initializeTelemetry: initTelemetry4, resetTelemetry: resetTelemetry4 } =
        require('./client')
      resetTelemetry4()
      mockNewTelemetryClient.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      await initTelemetry4()

      // Assert
      const options = mockNewTelemetryClient.mock.calls[0][3]
      expect(options.additionalAttrs.version).toBe('')
      jest.resetModules()
    })

    it('sets workspace type to development when PRODUCTION is false', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: 'vtex.test-app@1.0.0', VENDOR: 'vtex', VERSION: '1.0.0' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
          VTEX_IO_WORKSPACE_NAME: 'vtex_io.workspace.name',
          VTEX_IO_WORKSPACE_TYPE: 'vtex_io.workspace.type',
        },
        CLUSTER_ID: 'cluster-a',
        CLUSTER_ROLE: 'stores',
        DIAGNOSTICS_TELEMETRY_ENABLED: false,
        DK_APP_ID: 'apps-team',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector',
        PRODUCTION: false,
        WORKSPACE: 'master',
      }))
      const { initializeTelemetry: initTelemetry5, resetTelemetry: resetTelemetry5 } =
        require('./client')
      resetTelemetry5()
      mockNewTelemetryClient.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      await initTelemetry5()

      // Assert
      const options = mockNewTelemetryClient.mock.calls[0][3]
      expect(options.additionalAttrs['vtex_io.workspace.type']).toBe('development')
      jest.resetModules()
    })

    it('registers instrumentations when telemetry is enabled', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: 'vtex.test-app@1.0.0', VENDOR: 'vtex', VERSION: '1.0.0' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
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
      const { initializeTelemetry: initTelemetry6, resetTelemetry: resetTelemetry6 } =
        require('./client')
      resetTelemetry6()
      mockNewTelemetryClient.mockClear()
      telemetryClient.registerInstrumentations.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      await initTelemetry6()

      // Assert
      expect(telemetryClient.registerInstrumentations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(Object), // KoaInstrumentation
          expect.any(Object), // HostMetricsInstrumentation
        ])
      )
      jest.resetModules()
    })

    it('does not register instrumentations when telemetry is disabled', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      expect(telemetryClient.registerInstrumentations).not.toHaveBeenCalled()
    })

    it('logs success message when telemetry is enabled', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: 'vtex.test-app@1.0.0', VENDOR: 'vtex', VERSION: '1.0.0' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
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
      const { initializeTelemetry: initTelemetry7, resetTelemetry: resetTelemetry7 } =
        require('./client')
      resetTelemetry7()
      mockNewTelemetryClient.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Act
      await initTelemetry7()

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Telemetry enabled for app: vtex.test-app@1.0.0')
      )
      consoleSpy.mockRestore()
      jest.resetModules()
    })

    it('throws error and logs on telemetry client initialization failure', async () => {
      // Arrange
      const error = new Error('Failed to create telemetry client')
      mockNewTelemetryClient.mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert
      await expect(initializeTelemetry()).rejects.toThrow('Failed to create telemetry client')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize telemetry clients:', error)
      consoleSpy.mockRestore()
    })

    it('throws error on traces client initialization failure', async () => {
      // Arrange
      const error = new Error('Failed to initialize traces client')
      telemetryClient.newTracesClient.mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert
      await expect(initializeTelemetry()).rejects.toThrow('Failed to initialize traces client')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize telemetry clients:', error)
      consoleSpy.mockRestore()
    })

    it('throws error on metrics client initialization failure', async () => {
      // Arrange
      const error = new Error('Failed to initialize metrics client')
      telemetryClient.newMetricsClient.mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert
      await expect(initializeTelemetry()).rejects.toThrow('Failed to initialize metrics client')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize telemetry clients:', error)
      consoleSpy.mockRestore()
    })

    it('throws error on logs client initialization failure', async () => {
      // Arrange
      const error = new Error('Failed to initialize logs client')
      telemetryClient.newLogsClient.mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act & Assert
      await expect(initializeTelemetry()).rejects.toThrow('Failed to initialize logs client')
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize telemetry clients:', error)
      consoleSpy.mockRestore()
    })

    it('clears initialization promise on error', async () => {
      // Arrange
      const error = new Error('Initialization failed')
      mockNewTelemetryClient.mockRejectedValueOnce(error)
      jest.spyOn(console, 'error').mockImplementation()

      // Act
      try {
        await initializeTelemetry()
      } catch (e) {
        // Expected
      }

      // Reset mocks and clear to allow second attempt
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)
      jest.spyOn(console, 'error').mockRestore()
      resetTelemetry()

      // Act - Second attempt
      const clients = await initializeTelemetry()

      // Assert
      expect(clients).toEqual({ tracesClient, metricsClient, logsClient })
    })
  })

  describe('singleton pattern', () => {
    it('returns same instance on multiple calls', async () => {
      // Arrange & Act
      const clients1 = await initializeTelemetry()
      const clients2 = await initializeTelemetry()

      // Assert
      expect(clients1).toBe(clients2)
      expect(mockNewTelemetryClient).toHaveBeenCalledTimes(1)
    })

    it('returns cached clients without re-initialization', async () => {
      // Arrange
      await initializeTelemetry()
      mockNewTelemetryClient.mockClear()

      // Act
      const clients = await initializeTelemetry()

      // Assert
      expect(clients).toEqual({ tracesClient, metricsClient, logsClient })
      expect(mockNewTelemetryClient).not.toHaveBeenCalled()
    })

    it('handles concurrent calls during initialization', async () => {
      // Arrange
      const initDelay = new Promise(resolve => setTimeout(resolve, 10))
      mockNewTelemetryClient.mockImplementation(() => initDelay.then(() => telemetryClient))
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      const [clients1, clients2, clients3] = await Promise.all([
        initializeTelemetry(),
        initializeTelemetry(),
        initializeTelemetry(),
      ])

      // Assert
      expect(clients1).toEqual(clients2)
      expect(clients2).toEqual(clients3)
      expect(mockNewTelemetryClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('resetTelemetry', () => {
    it('clears cached clients', async () => {
      // Arrange
      await initializeTelemetry()
      mockNewTelemetryClient.mockClear()

      // Act
      resetTelemetry()
      const clients = await initializeTelemetry()

      // Assert
      expect(mockNewTelemetryClient).toHaveBeenCalledTimes(1)
      expect(clients).toEqual({ tracesClient, metricsClient, logsClient })
    })

    it('allows re-initialization after reset', async () => {
      // Arrange
      const clients1 = await initializeTelemetry()
      resetTelemetry()
      mockNewTelemetryClient.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      const clients2 = await initializeTelemetry()

      // Assert
      expect(clients1).not.toBe(clients2)
      expect(clients2).toEqual({ tracesClient, metricsClient, logsClient })
    })

    it('can be called multiple times safely', async () => {
      // Arrange
      await initializeTelemetry()

      // Act & Assert - should not throw
      expect(() => {
        resetTelemetry()
        resetTelemetry()
        resetTelemetry()
      }).not.toThrow()
    })
  })

  describe('exporter configuration', () => {
    it('calls CreateExporter with traces config and otlp type', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      expect(mockCreateExporter).toHaveBeenCalledWith({ signal: 'traces' }, 'otlp')
      expect(mockCreateExporter).toHaveBeenCalledWith({ signal: 'metrics' }, 'otlp')
      expect(mockCreateExporter).toHaveBeenCalledWith({ signal: 'logs' }, 'otlp')
    })

    it('passes endpoint to all exporter configs', async () => {
      // Arrange & Act
      await initializeTelemetry()

      // Assert
      expect(mockCreateTracesExporterConfig).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'http://collector' })
      )
      expect(mockCreateMetricsExporterConfig).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'http://collector' })
      )
      expect(mockCreateLogsExporterConfig).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'http://collector' })
      )
    })
  })

  describe('HostMetricsInstrumentation', () => {
    it('creates HostMetricsInstrumentation with meterProvider and name', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('../../constants', () => ({
        APP: { ID: 'vtex.test-app@1.0.0', VENDOR: 'vtex', VERSION: '1.0.0' },
        AttributeKeys: {
          VTEX_IO_APP_ID: 'vtex_io.app.id',
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
      const { initializeTelemetry: initTelemetry8, resetTelemetry: resetTelemetry8 } =
        require('./client')
      resetTelemetry8()
      mockNewTelemetryClient.mockClear()
      mockNewTelemetryClient.mockResolvedValue(telemetryClient)
      telemetryClient.newTracesClient.mockResolvedValue(tracesClient)
      telemetryClient.newMetricsClient.mockResolvedValue(metricsClient)
      telemetryClient.newLogsClient.mockResolvedValue(logsClient)

      // Act
      await initTelemetry8()

      // Assert
      expect(HostMetricsInstrumentation).toHaveBeenCalledWith(
        expect.objectContaining({
          meterProvider: { meterProvider: true },
          name: 'host-metrics-instrumentation',
        })
      )
      jest.resetModules()
    })
  })
})