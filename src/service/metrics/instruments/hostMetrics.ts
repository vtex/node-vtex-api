import { InstrumentationBase, InstrumentationConfig } from "@opentelemetry/instrumentation";
import { MeterProvider } from '@opentelemetry/api';
import { HostMetrics } from "@opentelemetry/host-metrics";

interface HostMetricsInstrumentationConfig extends InstrumentationConfig {
  name?: string;
  meterProvider?: MeterProvider;
}

export class HostMetricsInstrumentation extends InstrumentationBase<HostMetricsInstrumentationConfig> {
  private hostMetrics?: HostMetrics;

  constructor(config: HostMetricsInstrumentationConfig = {}) {
    const instrumentation_name = config.name || 'host-metrics-instrumentation';
    const instrumentation_version = '1.0.0';
    super(instrumentation_name, instrumentation_version, config);
  }

  init(): void {}

  enable(): void {
    if (!this._config.meterProvider) {
      throw new Error('MeterProvider is required for HostMetricsInstrumentation');
    }

    this.hostMetrics = new HostMetrics({
      meterProvider: this._config.meterProvider,
      name: this._config.name || 'host-metrics',
    });

    this.hostMetrics.start();
    console.debug('HostMetricsInstrumentation enabled');
  }

  disable(): void {
    if (this.hostMetrics) {
      this.hostMetrics = undefined;
      console.debug('HostMetricsInstrumentation disabled');
    }
  }
}
