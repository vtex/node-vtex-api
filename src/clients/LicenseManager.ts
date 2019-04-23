
import { stringify } from 'qs'

import { RequestConfig } from '../HttpClient/typings'
import { forExternal, IODataSource } from '../IODataSource'

const TWO_MINUTES_S = 2 * 60

const routes = {
  accountData: '/api/license-manager/account',
  topbarData: '/api/license-manager/site/pvt/newtopbar',
}

const inflightKey = ({baseURL, url, params}: RequestConfig) => {
  return baseURL! + url! + stringify(params, {arrayFormat: 'repeat', addQueryPrefix: true})
}

export class LicenseManager extends IODataSource {
  protected httpClientFactory = forExternal
  protected service = 'http://portal.vtexcommercestable.com.br'

  public getAccountData () {
    const {authToken, account} = this.context!

    return this.http.get(routes.accountData, {
      forceMaxAge: TWO_MINUTES_S,
      headers: {
        'Proxy-Authorization': authToken,
        VtexIdclientAutCookie: authToken,
      },
      inflightKey,
      metric: 'lm-account-data',
      params: {
        an: account,
      },
    })
  }

  public getTopbarData (VtexIdclientAutCookie: string) {
    const {authToken, account} = this.context!

    return this.http.get(routes.topbarData, {
      headers: {
        'Proxy-Authorization': authToken,
        VtexIdclientAutCookie,
      },
      memoizeable: false,
      metric: 'lm-topbar-data',
      params: {
        an: account,
      },
    })
  }
}
