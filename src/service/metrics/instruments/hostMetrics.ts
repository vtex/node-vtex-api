import { InstrumentationBase, InstrumentationConfig } from "@opentelemetry/instrumentation";
import { MeterProvider } from '@opentelemetry/api';

// Optional dependency - may not be available in all environments
let HostMetrics: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  HostMetrics = require("@opentelemetry/host-metrics").HostMetrics;
} catch {
  // Module not available - will be handled in enable()
}

interface HostMetricsInstrumentationConfig extends InstrumentationConfig {
  name?: string;
  meterProvider?: MeterProvider;
}

export class HostMetricsInstrumentation extends InstrumentationBase<HostMetricsInstrumentationConfig> {
  private hostMetrics?: any;

  constructor(config: HostMetricsInstrumentationConfig = {}) {
    const instrumentation_name = config.name || 'host-metrics-instrumentation';
    const instrumentation_version = '1.0.0';
    super(instrumentation_name, instrumentation_version, config);
  }

  init(): void {}

  enable(): void {
    if (!HostMetrics) {
      console.debug('HostMetricsInstrumentation: @opentelemetry/host-metrics not available, skipping');
      return;
    }

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
