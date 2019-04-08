import parseCookie from 'cookie'
import { pickBy, prop } from 'ramda'

import { inflightUrlWithQuery } from '../HttpClient/middlewares/inflight'
import { forExternal, IODataSource } from '../IODataSource'

export interface SegmentData {
  campaigns?: any
  channel: number
  priceTables?: any
  utm_campaign: string
  regionId?: string
  utm_source: string
  utmi_campaign: string
  currencyCode: string
  currencySymbol: string
  countryCode: string
  cultureInfo: string
  [key: string]: any
}

const SEGMENT_COOKIE = 'vtex_segment'
const SEGMENT_MAX_AGE_S = 10 * 60 // 10 minutes - segment is actually immutable

const sanitizeParams = (params?: Record<string, string>) => {
  return pickBy((_, key) => !!key, params || {})
}

const routes = {
  base: '/api/segments',
  segments: (token: string | void) => token ? `${routes.base}/${token}` : routes.base,
}

export class Segment extends IODataSource {
  public segment: (query?: Record<string, string>, token?: string) => Promise<SegmentData>
  protected httpClientFactory = forExternal
  protected service = 'http://portal.vtexcommercestable.com.br'

  constructor() {
    super()

    // Backwards compatibility
    this.segment = this.getSegment.bind(this)
  }

  public getSegment = (query?: Record<string, string>, token?: string) =>
    this.rawSegment(query, token).then(prop('data'))

  public getOrCreateSegment = async (query?: Record<string, string>, token?: string) => {
    const {
      data: segmentData,
      headers: {
        'set-cookie': [setCookies],
      },
    } = await this.rawSegment(query, token)
    const parsedCookie = parseCookie.parse(setCookies)
    const segmentToken = prop(SEGMENT_COOKIE, parsedCookie)
    return {
      segmentData,
      segmentToken,
    }
  }

  private rawSegment = (query?: Record<string, string>, token?: string) => {
    const {segmentToken, authToken, account} = this.context!
    const selectedToken = token || segmentToken
    return this.http.getRaw<SegmentData>(routes.segments(selectedToken), ({
      forceMaxAge: SEGMENT_MAX_AGE_S,
      headers: {
        'Content-Type': 'application/json',
        'Proxy-Authorization': authToken,
      },
      inflightKey: inflightUrlWithQuery,
      metric: 'segment-get',
      params: {
        ...sanitizeParams(query),
        an: account,
      },
    }))
  }
}
