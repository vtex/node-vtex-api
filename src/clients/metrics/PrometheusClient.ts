import promclient from 'prom-client'
import {
  createFrontendCLSInstrument,
  createFrontendFCPInstrument,
  createFrontendFIDInstrument,
  createFrontendLCPInstrument,
  createFrontendTTFBInstrument,
} from '../../service/tracing/metrics/instruments'
import { IOClient } from '../IOClient'

export class PrometheusClient extends IOClient {
  public static getFrontendMetrics() {
    if (!PrometheusClient.metrics) {
      PrometheusClient.metrics = PrometheusClient.initFrontendMetrics()
    }

    return PrometheusClient.metrics
  }

  private static metrics: WebVitalsGauges

  private static initFrontendMetrics() {
    const CLSGauge = createFrontendCLSInstrument()
    const FCPGauge = createFrontendFCPInstrument()
    const LCPGauge = createFrontendLCPInstrument()
    const FIDGauge = createFrontendFIDInstrument()
    const TTFBGauge = createFrontendTTFBInstrument()

    return {
      CLS: CLSGauge,
      FCP: FCPGauge,
      FID: FIDGauge,
      LCP: LCPGauge,
      TTFB: TTFBGauge,
    }
  }

  public sendWebVitals(sender: string, metric: WebVitalMetric) {
    PrometheusClient.getFrontendMetrics()
      [metric.name].labels(sender, this.context.account, this.context.workspace)
      .set(metric.value)
  }
}

export type WebVitalKey = 'FCP' | 'CLS' | 'FID' | 'LCP' | 'TTFB'

export interface WebVitalMetric {
  name: WebVitalKey
  value: number
}

export interface WebVitalsGauges {
  CLS: promclient.Gauge<string>
  FCP: promclient.Gauge<string>
  LCP: promclient.Gauge<string>
  FID: promclient.Gauge<string>
  TTFB: promclient.Gauge<string>
}
