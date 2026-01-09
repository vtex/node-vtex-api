import { inflightUrlWithQuery, RequestConfig } from '../../../HttpClient'
import { JanusClient } from '../JanusClient'
import { SalesChannel } from './types'

const BASE_URL = '/api/catalog_system'

const routes = {
  salesChannel: (salesChannelId: number) => `${BASE_URL}/pub/saleschannel/${salesChannelId}`,
}

export class Catalog extends JanusClient {
  public getSalesChannel(id: number, config?: RequestConfig) {
    const metric = 'catalog-saleschannel'
    return this.http.get<SalesChannel>(routes.salesChannel(id), {
      inflightKey: inflightUrlWithQuery,
      metric,
      ...config,
      tracing: {
        requestSpanNameSuffix: metric,
        ...config?.tracing,
      },
    })
  }
}
