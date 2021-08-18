import promclient from 'prom-client'
import {
  createFrontendCLSBySenderInstrument,
  createFrontendFIDBySenderInstrument,
  createFrontendLCPBySenderInstrument,
} from '../../service/tracing/metrics/instruments'
import { IOClient } from '../IOClient'

export class FrontendMetricsClient extends IOClient {
  public static getCoreWebVitalsMetrics() {
    if (!FrontendMetricsClient.coreWebVitalsMetrics) {
      FrontendMetricsClient.coreWebVitalsMetrics = FrontendMetricsClient.initCoreWebVitalsMetrics()
    }

    return FrontendMetricsClient.coreWebVitalsMetrics
  }

  private static coreWebVitalsMetrics: CoreWebVitalsMetrics

  private static initCoreWebVitalsMetrics() {
    const CLSHistogram = createFrontendCLSBySenderInstrument()
    const LCPHistogram = createFrontendLCPBySenderInstrument()
    const FIDHistogram = createFrontendFIDBySenderInstrument()

    return {
      CLS: CLSHistogram,
      FID: FIDHistogram,
      LCP: LCPHistogram,
    }
  }

  public sendCoreWebVitals(sender: string, metric: CoreWebVital) {
    FrontendMetricsClient.getCoreWebVitalsMetrics()[metric.name].labels(sender).observe(metric.value)
  }
}

export type CoreWebVitalKey = 'LCP' | 'CLS' | 'FID'

export interface CoreWebVital {
  name: CoreWebVitalKey
  value: number
}

export interface CoreWebVitalsMetrics {
  CLS: promclient.Histogram<string>
  LCP: promclient.Histogram<string>
  FID: promclient.Histogram<string>
}
