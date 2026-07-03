import { inflightUrlWithQuery, RequestConfig } from '../../../HttpClient'
import { JanusClient } from '../JanusClient'
import { SalesChannel } from './types'

const BASE_URL = '/api/catalog_system'

const routes = {
  defaultSalesChannel: () => `${BASE_URL}/pub/saleschannel/default`,
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

  public getDefaultSalesChannel(config?: RequestConfig) {
    const metric = 'catalog-saleschannel-default'
    return this.http.get<SalesChannel>(routes.defaultSalesChannel(), {
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
