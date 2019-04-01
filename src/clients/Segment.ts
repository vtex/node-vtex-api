import parseCookie from 'cookie'
import { pickBy, prop } from 'ramda'

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

const sanitizeParams = (params?: Record<string, string>) => {
  return pickBy((_, key) => !!key, params || {})
}

const routes = {
  base: '/api/segments',
  segments: (token: string | void) => token ? `${routes.base}/${token}` : routes.base,
}

export class Segment extends IODataSource {
  protected httpClientFactory = forExternal
  protected service = 'http://portal.vtexcommercebeta.com.br'

  public segment = (query?: Record<string, string>, token?: string) =>
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
      headers: {
        'Content-Type': 'application/json',
        'Proxy-Authorization': authToken,
      },
      metric: 'segment-get',
      params: {
        an: account,
        ...sanitizeParams(query),
      },
    }))
  }
}
