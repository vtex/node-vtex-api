import { stringify } from 'qs'

import { RequestConfig, RequestTracingConfig } from '../../HttpClient'
import { JanusClient } from './JanusClient'

const TWO_MINUTES_S = 2 * 60

const BASE_URL = '/api/license-manager'

const routes = {
  accountData: `${BASE_URL}/account`,
  resourceAccess: `${BASE_URL}/resources`,
  topbarData: `${BASE_URL}/site/pvt/newtopbar`,
}

const inflightKey = ({baseURL, url, params}: RequestConfig) => {
  return baseURL! + url! + stringify(params, {arrayFormat: 'repeat', addQueryPrefix: true})
}

export class LicenseManager extends JanusClient {
  public getAccountData (VtexIdclientAutCookie: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'lm-account-data'
    return this.http.get(routes.accountData, {
      forceMaxAge: TWO_MINUTES_S,
      headers: {
        VtexIdclientAutCookie,
      },
      inflightKey,
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public getTopbarData (VtexIdclientAutCookie: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'lm-topbar-data'
    return this.http.get(routes.topbarData, {
      headers: {
        VtexIdclientAutCookie,
      },
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })
  }

  public canAccessResource (VtexIdclientAutCookie: string, resourceKey: string, tracingConfig?: RequestTracingConfig) {
    const metric = 'lm-resource-access'
    return this.http.get(`${routes.resourceAccess}/${resourceKey}/access`, {
      headers: {
        VtexIdclientAutCookie,
      },
      metric,
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    }).then(() => true, () => false)
  }
}
