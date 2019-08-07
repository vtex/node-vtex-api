import parseCookie from 'cookie'
import { prop } from 'ramda'

import { JanusClient } from './../HttpClient'

const SESSION_COOKIE = 'vtex_session'

const routes = {
  base: '/api/sessions',
}

export class Session extends JanusClient {
  /**
   * Get the session data using the given token
   */
  public getSession = async (token: string, items: string[]) => {
    const {
      data: sessionData,
      headers: {
        'set-cookie': [setCookies],
      },
    } = await this.http.getRaw<any>(routes.base, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `vtex_session=${token};`,
      },
      metric: 'session-get',
      params: {
        items: items.join(','),
      },
    })

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
  public updateSession = (
    key: string,
    value: any,
    items: string[],
    token: any
  ) => {
    const data = { public: { [key]: { value } } }
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `vtex_session=${token};`,
      },
      metric: 'session-update',
      params: {
        items: items.join(','),
      },
    }

    return this.http.post(routes.base, data, config)
  }
}
