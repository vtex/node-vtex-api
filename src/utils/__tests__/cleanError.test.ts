import { cleanError } from '../error'

// Fake credentials only.
const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'

const axiosLikeError = (headers: Record<string, string>) => {
  const err: any = new Error('Request failed with status code 400')
  err.config = { headers, method: 'get', url: '/orders' }
  err.response = { data: { reason: 'bad input' }, headers: { 'set-cookie': `vtex_session=${TOKEN}`, 'content-type': 'application/json' }, status: 400 }
  return err
}

describe('cleanError', () => {
  it('drops every credential header from what is logged, keeping the others', () => {
    const cleaned = cleanError(axiosLikeError({
      'Authorization': `Bearer ${TOKEN}`,
      'Proxy-Authorization': TOKEN,
      'VtexIdclientAutCookie': TOKEN,
      'VtexIdclientAutCookie_acme': TOKEN,
      'X-Vtex-Api-AppKey': TOKEN,
      'X-Vtex-Api-AppToken': TOKEN,
      'X-Vtex-Credential': TOKEN,
      'accept': 'application/json',
      'cookie': `vtex_session=${TOKEN}`,
      'x-vtex-use-https': 'true',
    }))

    expect(JSON.stringify(cleaned)).not.toContain(TOKEN)
    expect(cleaned.config.headers).toEqual({ 'accept': 'application/json', 'x-vtex-use-https': 'true' })
    expect(cleaned.response.headers).toEqual({ 'content-type': 'application/json' })
  })

  it('keeps response headers that only look like credentials', () => {
    const err = axiosLikeError({ accept: 'application/json' })
    err.response.headers['www-authenticate'] = 'Bearer realm="vtex"'

    expect(cleanError(err).response.headers).toEqual({ 'content-type': 'application/json', 'www-authenticate': 'Bearer realm="vtex"' })
  })

  it('logs the safe fields of a hidden request, never its raw header block', () => {
    const err = axiosLikeError({ accept: 'application/json' })
    const request = { _header: `GET /orders HTTP/1.1\r\nproxy-authorization: ${TOKEN}`, finished: true, method: 'GET', path: '/orders', socket: { secret: TOKEN } }
    Object.defineProperty(err, 'request', { configurable: true, enumerable: false, value: request, writable: true })

    const cleaned = cleanError(err)

    expect(cleaned.request).toEqual({ finished: true, method: 'GET', path: '/orders' })
    expect(JSON.stringify(cleaned)).not.toContain(TOKEN)
  })

  it('masks credential-named params in the logged request path and config url', () => {
    const err = axiosLikeError({ accept: 'application/json' })
    err.config.url = `/orders?an=acme&appToken=${TOKEN}`
    const request = { method: 'GET', path: `/orders?filter%5BappToken%5D=${TOKEN}&page=2` }
    Object.defineProperty(err, 'request', { configurable: true, enumerable: false, value: request, writable: true })

    const cleaned = cleanError(err)

    expect(cleaned.request.path).toBe('/orders?filter%5BappToken%5D=[Redacted]&page=2')
    expect(cleaned.config.url).toBe('/orders?an=acme&appToken=[Redacted]')
  })

  it('keeps what is needed to debug', () => {
    const cleaned = cleanError(axiosLikeError({ accept: 'application/json' }))

    expect(cleaned).toMatchObject({
      code: 'E_HTTP_400',
      config: { method: 'get', url: '/orders' },
      message: 'Request failed with status code 400',
      response: { data: { reason: 'bad input' }, status: 400 },
    })
    expect(cleaned.stack).toContain('Request failed with status code 400')
  })

  it('truncates very large strings to 8 KB', () => {
    const err: any = new Error('failed')
    err.details = 'x'.repeat(8 * 1024 + 10)

    expect(cleanError(err).details).toBe(`${'x'.repeat(8 * 1024)}[...TRUNCATED]`)
  })
})
