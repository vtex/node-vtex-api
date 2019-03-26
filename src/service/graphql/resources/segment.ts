import { prop } from 'ramda'

import { HttpClient, HttpClientFactory, InstanceOptions, IOContext, IODataSource, Logger } from '../../..'


const factory: HttpClientFactory = ({context, options}) => context &&
  HttpClient.forExternal(`http://portal.vtexcommercestable.com.br`, context, options || {})

interface Segment {
  channel: number,
  utm_campaign: string,
  utm_source: string,
  utmi_campaign: string,
  currencyCode: string,
  currencySymbol: string,
  countryCode: string,
  cultureInfo: string
}

const routes = {
  segments: (token: string | undefined) => token ? `/api/segments/${token}` : '/api/segments',
}

export class SegmentAPI extends IODataSource{
  protected memoizedResults: Record<string, Promise<Segment | null>>
  protected httpClientFactory = factory

  constructor(ctx: IOContext, opts: InstanceOptions, protected logger: Logger) {
    super(ctx, opts)
    this.memoizedResults = {}
  }

  public segment = () => {
    const {segmentToken, authToken, account} = this.context!
    const key = segmentToken + account

    if (!this.memoizedResults[key]) {
      this.memoizedResults[key] = this.http.get<Segment>(routes.segments(segmentToken), {
        headers: {
          'Content-Type': 'application/json',
          'Proxy-Authorization': authToken,
        },
        metric: 'runtime-segment',
        params: {
          an: account,
        },
      }).catch(err => {
        this.logger.error(err).catch(console.log)
        return null
      })
    }

    return this.memoizedResults[key]
  }

  public getTo = () => this.segment().then(res => res && prop('cultureInfo', res))
}
