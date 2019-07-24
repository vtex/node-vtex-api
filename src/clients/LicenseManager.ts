
import { stringify } from 'qs'

import { JanusClient, RequestConfig } from '../HttpClient'

const TWO_MINUTES_S = 2 * 60

const BASE_URL = '/api/license-manager'

const routes = {
  accountData: `${BASE_URL}/account`,
  resourceAccess: `${BASE_URL}/resources`,
  topbarData: `${BASE_URL}/site/pvt/newtopbar`
}

const inflightKey = ({baseURL, url, params}: RequestConfig) => {
  return baseURL! + url! + stringify(params, {arrayFormat: 'repeat', addQueryPrefix: true})
}

export class LicenseManager extends JanusClient {
  public getAccountData (VtexIdclientAutCookie: string) {
    const authToken = VtexIdclientAutCookie || this.context.authToken

    return this.http.get(routes.accountData, {
      forceMaxAge: TWO_MINUTES_S,
      headers: {
        VtexIdclientAutCookie: authToken,
      },
      inflightKey,
      metric: 'lm-account-data',
    })
  }

  public getTopbarData (VtexIdclientAutCookie: string) {
    return this.http.get(routes.topbarData, {
      headers: {
        VtexIdclientAutCookie,
      },
      metric: 'lm-topbar-data',
    })
  }

  public canAccessResource (VtexIdclientAutCookie: string, resourceKey: string) {
    return this.http.get(`${routes.resourceAccess}/${resourceKey}/access`, {
      headers: {
        VtexIdclientAutCookie,
      },
      metric: 'lm-resource-access',
    }).then(() => true, () => false)
  }
}
