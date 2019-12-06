import { inflightUrlWithQuery } from '../../HttpClient'
import { InstanceOptions, RequestConfig } from '../../HttpClient/typings'
import { IOContext } from '../../service/worker/runtime/typings'
import { JanusClient } from './JanusClient'

interface Binding {
  id: string
  canonicalBaseAddress: string
  alternateBaseAddresses: string[]
  defaultLocale: string
  supportedLocales: string[]
  defaultCurrency: string
  supportedCurrencies: string[]
  extraContext: Record<string, any>
  targetProduct: string
}

interface Tenant {
  id: string
  slug: string
  title: string
  edition: string
  infra: string
  bindings: Binding[]
  defaultCurrency: string
  defaultLocale: string
  metadata: Record<string, string>
}

export class TenantClient extends JanusClient {
  constructor(ctx: IOContext, opts?: InstanceOptions) {
    super(ctx, {
      ...opts,
      params: {
        q: ctx.account,
      },
    })
  }

  public info = (config?: RequestConfig) => this.http.get<Tenant>('/api/tenant/tenants', {
    inflightKey: inflightUrlWithQuery,
    memoizeable: true,
    metric: 'get-tenant-info',
    ...config,
  })
}
