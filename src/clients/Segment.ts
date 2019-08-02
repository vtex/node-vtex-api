import parseCookie from 'cookie'
import { pickBy, prop } from 'ramda'

import { PRODUCT_HEADER } from '../constants'
import { inflightUrlWithQuery, JanusClient } from '../HttpClient'

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
  segments: (token?: string | null) => token ? `${routes.base}/${token}` : routes.base,
}

export class Segment extends JanusClient {
  /**
   * @deprecated Please use `getSegment` or `getSegmentByToken` instead.
   *
   * @memberof Segment
   */
  public segment = (query?: Record<string, string>, token?: string) =>
    this.rawSegment(token || this.context!.segmentToken, query).then(prop('data'))

  /**
   * Get the segment data using the current `ctx.vtex.segmentToken`
   *
   * @memberof Segment
   */
  public getSegment = () =>
    this.rawSegment(this.context!.segmentToken).then(prop('data'))

  /**
   * Get the segment data from this specific segment token
   *
   * @memberof Segment
   */
  public getSegmentByToken = (token: string | null) =>
    this.rawSegment(token).then(prop('data'))

  public getOrCreateSegment = async (query?: Record<string, string>, token?: string) => {
    const {
      data: segmentData,
      headers: {
        'set-cookie': [setCookies],
      },
    } = await this.rawSegment(token, query)
    const parsedCookie = parseCookie.parse(setCookies)
    const segmentToken = prop(SEGMENT_COOKIE, parsedCookie)
    return {
      segmentData,
      segmentToken,
    }
  }

  private rawSegment = (token?: string | null, query?: Record<string, string>) => {
    const { product } = this.context

    return this.http.getRaw<SegmentData>(routes.segments(token), ({
      forceMaxAge: SEGMENT_MAX_AGE_S,
      headers: {
        'Content-Type': 'application/json',
        [PRODUCT_HEADER]: product || '',
      },
      inflightKey: inflightUrlWithQuery,
      metric: 'segment-get',
      params: {
        ...sanitizeParams(query),
        // eslint-disable-next-line @typescript-eslint/camelcase
        session_path: product || '',
      },
    }))
  }
}
