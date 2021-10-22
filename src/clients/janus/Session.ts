import parseCookie from 'cookie'

import { RequestTracingConfig } from '../../HttpClient'
import { JanusClient } from './JanusClient'

const SESSION_COOKIE = 'vtex_session'

const routes = {
  base: '/api/sessions',
}

export class Session extends JanusClient {
  /**
   * Get the session data using the given token
   */
  public getSession = async (token: string, items: string[], tracingConfig?: RequestTracingConfig) => {
    const metric = 'session-get'
    const { data: sessionData, headers } = await this.http.getRaw<any>(routes.base, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `vtex_session=${token};`,
      },
      metric,
      params: {
        items: items.join(','),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    })

    return {
      sessionData,
      sessionToken: extractSessionCookie(headers) ?? token,
    }
  }

  /**
   * Update the public portion of this session
   */
  public updateSession = (key: string, value: any, items: string[], token: any, tracingConfig?: RequestTracingConfig) => {
    const data = { public: { [key]: { value } } }
    const metric = 'session-update' 
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `vtex_session=${token};`,
      },
      metric,
      params: {
        items: items.join(','),
      },
      tracing: {
        requestSpanNameSuffix: metric,
        ...tracingConfig?.tracing,
      },
    }

    return this.http.post(routes.base, data, config)
  }
}

export function extractSessionCookie(headers: Record<string, string>) {
  for (const setCookie of headers['set-cookie'] ?? []) {
    const parsedCookie = parseCookie.parse(setCookie)
    const sessionCookie = parsedCookie[SESSION_COOKIE]
    if (sessionCookie != null) {
        return sessionCookie
    }
  }

  return null
}
