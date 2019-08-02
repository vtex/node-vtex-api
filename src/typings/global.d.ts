import { MetricsAccumulator } from '../metrics/MetricsAccumulator'

declare global {
  // eslint-disable-next-line no-redeclare
  const metrics: MetricsAccumulator
}
