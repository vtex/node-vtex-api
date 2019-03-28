import { HttpClient, InstanceOptions } from '../HttpClient'
import { HttpClientFactory, IODataSource } from '../IODataSource'
import { IOContext } from '../service/typings'

interface SegmentData {
  channel: number
  utm_campaign: string
  utm_source: string
  utmi_campaign: string
  currencyCode: string
  currencySymbol: string
  countryCode: string
  cultureInfo: string
  [key: string]: any
}

const factory: HttpClientFactory = ({context, options}) => context &&
  HttpClient.forExternal(`http://portal.vtexcommercestable.com.br`, context, options || {})

const routes = {
  segments: (token: string | undefined) => token ? `/api/segments/${token}` : '/api/segments',
}

export class Segment extends IODataSource {
  protected httpClientFactory = factory

  constructor(ctx: IOContext, opts: InstanceOptions) {
    super(ctx, opts)
  }

  public segment = (query?: Record<string, string>, token?: string) => {
    const {segmentToken, authToken, account} = this.context!
    const selectedToken = token || segmentToken
    const config = this.segmentConfig({authToken, query, account})

    return this.http.get<SegmentData>(routes.segments(selectedToken), config)
  }

  public rawSegment = (query?: Record<string, string>, token?: string) => {
    const {segmentToken, authToken, account} = this.context!
    const selectedToken = token || segmentToken
    const config = this.segmentConfig({authToken, query, account})

    return this.http.getRaw<SegmentData>(routes.segments(selectedToken), config)
  }

  private segmentConfig = ({authToken, query, account}: {authToken: string, query?: Record<string, string>, account: string}) => ({
    headers: {
      'Content-Type': 'application/json',
      'Proxy-Authorization': authToken,
    },
    metric: 'segment-get',
    params: {
      an: account,
      ...query,
    },
  })
}
