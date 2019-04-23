import parseCookie from 'cookie'
import { prop } from 'ramda'

import { forExternal, IODataSource } from '../IODataSource'

const SESSION_COOKIE = 'vtex_session'

const routes = {
  base: '/api/sessions',
}

export class Session extends IODataSource {
  protected httpClientFactory = forExternal
  protected service = 'http://portal.vtexcommercestable.com.br'

  /**
   * Get the session data using the given token
   */
  public getSession = async (token: string, items: string[]) => {
    const {account, authToken} = this.context!

    const {
      data: sessionData,
      headers: {
        'set-cookie': [setCookies],
      },
    } = await this.http.getRaw<any>(routes.base, ({
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `vtex_session=${token};`,
        'Proxy-Authorization': authToken,
      },
      metric: 'session-get',
      params: {
        an: account,
        items: items.join(','),
      },
    }))

    const parsedCookie = parseCookie.parse(setCookies)
    const sessionToken = prop(SESSION_COOKIE, parsedCookie)

    return {
      sessionData,
      sessionToken,
    }
  }

  /**
   * Update the public portion of this session
   */
  public updateSession = (key: string, value: any, items: string[], token: any) => {
    const {account, authToken} = this.context!

    const data = { public: { [key]: { value } } }
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `vtex_session=${token};`,
        'Proxy-Authorization': authToken,
      },
      metric: 'session-update',
      params: {
        an: account,
        items: items.join(','),
      },
    }

    return this.http.post(routes.base, data, config)
  }
}
