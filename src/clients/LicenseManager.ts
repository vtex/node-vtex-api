
import { stringify } from 'qs'

import { JanusClient, RequestConfig } from '../HttpClient'

const TWO_MINUTES_S = 2 * 60

const routes = {
  accountData: '/api/license-manager/account',
  topbarData: '/api/license-manager/site/pvt/newtopbar',
}

const inflightKey = ({baseURL, url, params}: RequestConfig) => {
  return baseURL! + url! + stringify(params, {arrayFormat: 'repeat', addQueryPrefix: true})
}

export class LicenseManager extends JanusClient {
  public getAccountData () {
    const {authToken} = this.context!

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
      memoizeable: false,
      metric: 'lm-topbar-data',
    })
  }
}
