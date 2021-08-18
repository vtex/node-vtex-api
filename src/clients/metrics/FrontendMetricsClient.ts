import promclient from 'prom-client'
import {
  createFrontendCLSBySenderInstrument,
  createFrontendFCPBySenderInstrument,
  createFrontendFIDBySenderInstrument,
  createFrontendLCPBySenderInstrument,
  createFrontendTTFBBySenderInstrument,
} from '../../service/tracing/metrics/instruments'
import { IOClient } from '../IOClient'

export class FrontendMetricsClient extends IOClient {
  public static getWebVitalsMetrics() {
    if (!FrontendMetricsClient.webVitalsMetrics) {
      FrontendMetricsClient.webVitalsMetrics = FrontendMetricsClient.initWebVitalsMetrics()
    }

    return FrontendMetricsClient.webVitalsMetrics
  }

  private static webVitalsMetrics: WebVitalsMetrics

  private static initWebVitalsMetrics() {
    const CLSHistogram = createFrontendCLSBySenderInstrument()
    const FCPHistogram = createFrontendFCPBySenderInstrument()
    const LCPHistogram = createFrontendLCPBySenderInstrument()
    const FIDHistogram = createFrontendFIDBySenderInstrument()
    const TTFBHistogram = createFrontendTTFBBySenderInstrument()

    return {
      CLS: CLSHistogram,
      FCP: FCPHistogram,
      FID: FIDHistogram,
      LCP: LCPHistogram,
      TTFB: TTFBHistogram,
    }
  }

  public sendWebVitals(sender: string, metric: WebVitalMetric) {
    FrontendMetricsClient.getWebVitalsMetrics()[metric.name].labels(sender).observe(metric.value)
  }
}

export type WebVitalKey = 'FCP' | 'CLS' | 'FID' | 'LCP' | 'TTFB'

export interface WebVitalMetric {
  name: WebVitalKey
  value: number
}

export interface WebVitalsMetrics {
  CLS: promclient.Histogram<string>
  FCP: promclient.Histogram<string>
  LCP: promclient.Histogram<string>
  FID: promclient.Histogram<string>
  TTFB: promclient.Histogram<string>
}
