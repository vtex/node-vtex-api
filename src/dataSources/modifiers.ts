import { ServiceContext } from '../HttpClient'
import { Modifier, ModOptions } from './OutboundDataSource'

const appendCookie = (headers: ModOptions['headers'], key: string, value?: string) => {
  if (!value || value === '') {
    return
  }
  const cookies = headers.get('Cookie')
  headers.set('Cookie', cookies && cookies !== ''
    ? `${cookies}; ${key}=${value}`
    : `${key}=${value}`,
  )
}

export const withLegacyAppAuth: Modifier = <T extends ServiceContext> (opts: ModOptions, {vtex: {authToken}}: T) => {
  const cookieName = 'VtexIdClientAutCookie'
  const { headers } = opts
  headers.set(cookieName, authToken)
  appendCookie(headers, cookieName, authToken)
  return opts
}

export const withLegacyUserAuth: Modifier = <T extends ServiceContext> (opts: ModOptions, {cookies}: T) => {
  const cookieName = 'VtexIdClientAutCookie'
  const { headers } = opts
  const cookie = cookies.get(cookieName)
  if (cookie) {
    appendCookie(headers, cookieName, cookie)
    headers.set(cookieName, cookie)
  }
  return opts
}

export const useHttps: Modifier = (opts: ModOptions) => {
  const { headers } = opts
  headers.set('X-Vtex-Use-Https', 'true')
  return opts
}

export const withSegment: Modifier = <T extends ServiceContext> (opts: ModOptions, {cookies}: T) => {
  const cookieName = 'vtex_segment'
  const { headers } = opts
  appendCookie(headers, cookieName, cookies.get(cookieName))
  return opts
}

export const withSession: Modifier = <T extends ServiceContext> (opts: ModOptions, {cookies}: T) => {
  const cookieName = 'vtex_session'
  const { headers } = opts
  appendCookie(headers, cookieName, cookies.get(cookieName))
  return opts
}

export const withOutboundAuth: Modifier = <T extends ServiceContext> (opts: ModOptions, {vtex: {authToken}}: T) => {
  const { headers } = opts
  headers.set('Proxy-Authorization', authToken)
  return opts
}

export const withAuth: Modifier = <T extends ServiceContext> (opts: ModOptions, {vtex: {authToken}}: T) => {
  const { headers } = opts
  headers.set('Authorization', authToken)
  return opts
}

export const withCookies: Modifier = <T extends ServiceContext> (opts: ModOptions, ctx: T) => {
  const { headers } = opts
  const availableCookies = headers.get('Cookie')
  headers.set('Cookie', availableCookies && availableCookies !== ''
    ? `${availableCookies}; ${ctx.get('Cookie')}`
    : `${ctx.get('Cookie')}`,
  )
  return opts
}

export const withTimeout = (TIMEOUT_MS: number): Modifier => (opts: ModOptions) => {
  opts.timeout = TIMEOUT_MS
  return opts
}

export const withHeader = (key: string, value: string): Modifier => (opts: ModOptions) => {
  const { headers } = opts
  headers.set(key, value)
  return opts
}

export const forward = (key: string): Modifier => <T extends ServiceContext> (opts: ModOptions, ctx: T) => {
  opts.headers.set(key, ctx.get(key))
  return opts
}
