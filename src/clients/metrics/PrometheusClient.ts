import promclient, { Metric } from 'prom-client'
import {
  createFrontendCLSInstrument,
  createFrontendFCPInstrument,
  createFrontendFIDInstrument,
  createFrontendLCPInstrument,
  createFrontendTTFBInstrument,
} from '../../service/tracing/metrics/instruments'

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

class PrometheusClient {
  public static getMetrics() {
    if (!PrometheusClient.metrics) {
      PrometheusClient.metrics = PrometheusClient.initMetrics()
    }

    return PrometheusClient.metrics
  }

  private static metrics: WebVitalsGauges

  private static initMetrics() {
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
    PrometheusClient.getMetrics()[metric.name].labels(sender).set(metric.value)
  }
}

export const prometheusClient = new PrometheusClient()
