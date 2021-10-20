import { prop } from 'ramda'

import { PRODUCT_HEADER } from '../constants'
import { inflightUrlWithQuery, JanusClient } from '../HttpClient'
import { extractSessionCookie } from './Session'

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

const SEGMENT_MAX_AGE_S = 60 * 60 // 60 minutes - segment is actually immutable
const ALLOWED_QUERY_PREFIXES = ['utm', 'cultureInfo', 'supportedLocales']

const filterAndSortQuery = (query?: Record<string, string>) => {
  if (!query) {
    return null
  }

  const filteredKeys = Object.keys(query)
    .filter((k: string) => !!k && ALLOWED_QUERY_PREFIXES.some((prefix: string) => k.startsWith(prefix)))
    .sort()

  return filteredKeys.reduce((acc: Record<string, string>, val: string) => {
    acc[val] = query[val]
    return acc
  }, {})
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
      headers,
    } = await this.rawSegment(token, query)
    return {
      segmentData,
      segmentToken: extractSessionCookie(headers) || token,
    }
  }

  private rawSegment = (token?: string | null, query?: Record<string, string>) => {
    const { product } = this.context
    const filteredQuery = filterAndSortQuery(query)

    return this.http.getRaw<SegmentData>(routes.segments(token), ({
      forceMaxAge: SEGMENT_MAX_AGE_S,
      headers: {
        'Content-Type': 'application/json',
        [PRODUCT_HEADER]: product || '',
      },
      inflightKey: inflightUrlWithQuery,
      metric: token ? 'segment-get-token' : 'segment-get-new',
      params: {
        ...filteredQuery,
        session_path: product || '',
      },
    }))
  }
}
