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
  protected memoizedResults: Record<string, Promise<SegmentData>>
  protected httpClientFactory = factory

  constructor(ctx: IOContext, opts: InstanceOptions) {
    super(ctx, opts)
    this.memoizedResults = {}
  }

  public segment = () => {
    const {segmentToken, authToken, account} = this.context!
    const key = segmentToken + account

    if (!this.memoizedResults[key]) {
      this.memoizedResults[key] = this.http.get<SegmentData>(routes.segments(segmentToken), {
        headers: {
          'Content-Type': 'application/json',
          'Proxy-Authorization': authToken,
        },
        metric: 'segment-get',
        params: {
          an: account,
        },
      })
    }

    return this.memoizedResults[key]
  }
}
