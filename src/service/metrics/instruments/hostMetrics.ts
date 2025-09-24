import { MeterProvider } from '@opentelemetry/api'
import { HostMetrics } from '@opentelemetry/host-metrics'
import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation'

interface HostMetricsInstrumentationConfig extends InstrumentationConfig {
  name?: string
  meterProvider?: MeterProvider
}

export class HostMetricsInstrumentation extends InstrumentationBase<HostMetricsInstrumentationConfig> {
  private hostMetrics?: HostMetrics

  constructor(config: HostMetricsInstrumentationConfig = {}) {
    const instrumentationName = config.name || 'host-metrics-instrumentation'
    const instrumentationVersion = '1.0.0'
    super(instrumentationName, instrumentationVersion, config)
  }

  public init(): void {
    // No initialization required
  }

  public enable(): void {
    if (!this._config.meterProvider) {
      throw new Error('MeterProvider is required for HostMetricsInstrumentation')
    }

    this.hostMetrics = new HostMetrics({
      meterProvider: this._config.meterProvider,
      name: this._config.name || 'host-metrics',
    })

    this.hostMetrics.start()
    console.debug('HostMetricsInstrumentation enabled')
  }

  public disable(): void {
    if (this.hostMetrics) {
      this.hostMetrics = undefined
      console.debug('HostMetricsInstrumentation disabled')
    }
  }
}
