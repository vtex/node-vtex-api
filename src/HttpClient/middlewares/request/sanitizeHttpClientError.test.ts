/**
 * @jest-environment node
 */
import axios from 'axios'
import { createServer, IncomingMessage, Server } from 'http'
import { AddressInfo } from 'net'
import { inspect } from 'util'

import { cleanError } from '../../../utils/error'
import { MiddlewareContext } from '../../typings'
import { defaultsMiddleware, requestMiddleware } from './index'
import { sanitizeHttpClientError } from './sanitizeHttpClientError'

// Fake credentials only.
const TOKEN = 'app-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'
const STORE_TOKEN = 'store-token-eyJhbGciOiJSUzI1NiJ9.payload.signature'
const REDACTED = '[Redacted]'

const listen = (server: Server) =>
  new Promise<string>(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)))
const close = (server: Server) => new Promise<void>(resolve => server.close(() => resolve()))

const CREDENTIAL_HEADERS = {
  'Proxy-Authorization': TOKEN,
  'VtexIdclientAutCookie_acme': STORE_TOKEN,
  'X-Vtex-Api-AppToken': TOKEN,
  'cookie': `vtex_session=${STORE_TOKEN}`,
  'x-vtex-use-https': 'true',
}

describe('sanitizeHttpClientError', () => {
  let upstream: Server
  let baseURL: string
  let received: Array<IncomingMessage>
  let flaky: number

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      received.push(req)
      if (req.url!.startsWith('/flaky') && flaky-- > 0) {
        res.statusCode = 503
        res.end('{}')
        return
      }
      if (req.url!.startsWith('/fail')) {
        res.statusCode = 400
        res.setHeader('content-type', 'application/json')
        res.setHeader('set-cookie', `vtex_session=${STORE_TOKEN}; Path=/`)
        res.setHeader('www-authenticate', 'Bearer realm="vtex"')
        res.setHeader('idempotency-key', 'order-123')
        res.end(JSON.stringify({ reason: 'bad input' }))
        return
      }
      res.end('{"ok":true}')
    })
    baseURL = await listen(upstream)
  })

  afterAll(() => close(upstream))

  beforeEach(() => {
    received = []
    flaky = 0
  })

  // The runtime pipeline of an HttpClient call: defaults, then the request with its interceptors.
  const call = async (url: string, config: Record<string, any> = {}, retries = 0) => {
    const ctx = { config: { url, ...config } } as unknown as MiddlewareContext
    const defaults = defaultsMiddleware({
      baseURL,
      initialBackoffDelay: 1,
      params: undefined,
      rawHeaders: CREDENTIAL_HEADERS,
      retries,
      timeout: 5000,
    })
    await defaults(ctx, () => requestMiddleware()(ctx, async () => undefined))
    return ctx
  }

  const failure = async (url = '/fail', config: Record<string, any> = {}) => {
    try {
      await call(url, config)
    } catch (e) {
      return e as any
    }
    throw new Error('the call was expected to fail')
  }

  describe('keeps the error as it is', () => {
    it('is the same kind of error, with its message, code, stack, status and data', async () => {
      const err = await failure()

      expect(err).toBeInstanceOf(Error)
      expect(axios.isAxiosError(err)).toBe(true)
      expect(err.message).toBe('Request failed with status code 400')
      expect(err.code).toBe('ERR_BAD_REQUEST')
      expect(err.stack).toContain('Request failed with status code 400')
      expect(err.response.status).toBe(400)
      expect(err.response.data).toEqual({ reason: 'bad input' })
    })

    it('keeps the request readable, out of what is serialized', async () => {
      const err = await failure()

      expect(err.request).toBeTruthy()
      expect(err.request.path).toBe('/fail')
      expect(err.request.method).toBe('GET')
      expect(Object.keys(err)).not.toContain('request')
      expect(Object.keys(err.response)).not.toContain('request')
    })

    it('keeps the request readable on a network error, which has no response', async () => {
      const closed = createServer()
      const closedURL = await listen(closed)
      await close(closed)

      const err = await failure(`${closedURL}/down`)

      expect(err.response).toBeUndefined()
      // The usual axios branch: `if (err.response) … else if (err.request) …`.
      expect(err.request).toBeTruthy()
      expect(err.request.path).toBe('/down')
      expect(JSON.stringify(err)).not.toContain(TOKEN)
    })

    it('keeps the header names and the values that are not credentials', async () => {
      const err = await failure()
      const headers = typeof err.config.headers.toJSON === 'function' ? err.config.headers.toJSON() : err.config.headers

      expect(headers['proxy-authorization']).toBe(REDACTED)
      expect(headers.vtexidclientautcookie_acme).toBe(REDACTED)
      expect(headers['x-vtex-api-apptoken']).toBe(REDACTED)
      expect(headers.cookie).toBe(REDACTED)
      expect(headers['x-vtex-use-https']).toBe('true')
    })
  })

  describe('removes the credentials', () => {
    it('from every way the error is serialized, printed or logged', async () => {
      const err = await failure()

      expect(JSON.stringify(err)).not.toContain(TOKEN)
      expect(JSON.stringify(err.toJSON())).not.toContain(TOKEN)
      expect(inspect(err, { depth: 10 })).not.toContain(TOKEN)
      expect(inspect({ ...err }, { depth: 10 })).not.toContain(TOKEN)
      expect(JSON.stringify(cleanError(err))).not.toContain(TOKEN)
      expect(JSON.stringify(new Error(`failed: ${JSON.stringify(err)}`).message)).not.toContain(TOKEN)
      for (const text of [JSON.stringify(err), inspect(err, { depth: 10 }), JSON.stringify(cleanError(err))]) {
        expect(text).not.toContain(STORE_TOKEN)
      }
    })

    it('from the response, which holds the config too, and from its set-cookie header', async () => {
      const err = await failure()

      expect(JSON.stringify({ config: err.response.config, headers: err.response.headers })).not.toContain(STORE_TOKEN)
      expect(JSON.stringify(err.response.config)).not.toContain(TOKEN)
      expect(err.response.headers['set-cookie']).toBe(REDACTED)
      expect(err.response.headers['content-type']).toBe('application/json')
    })

    it('keeps the other response headers, even when their names look like credentials', async () => {
      const err = await failure()

      expect(err.response.headers['www-authenticate']).toBe('Bearer realm="vtex"')
      expect(err.response.headers['idempotency-key']).toBe('order-123')
    })

    it('still logs where the request went, without the raw request', async () => {
      const logged = cleanError(await failure())

      expect(logged.request).toMatchObject({ method: 'GET', path: '/fail' })
      expect(JSON.stringify(logged)).not.toContain(TOKEN)
      expect(JSON.stringify(logged)).not.toContain(STORE_TOKEN)
      expect(logged.response.headers['www-authenticate']).toBe('Bearer realm="vtex"')
      expect(logged.response.headers).not.toHaveProperty('set-cookie')
    })

    it('from credential-named keys in the request body, keeping the others', async () => {
      const body = { apiKey: TOKEN, clientSecret: TOKEN, name: 'catalog' }

      const err = await failure('/fail', { data: body, method: 'post' })
      const data = typeof err.config.data === 'string' ? JSON.parse(err.config.data) : err.config.data

      expect(data).toEqual({ apiKey: REDACTED, clientSecret: REDACTED, name: 'catalog' })
      expect(body).toEqual({ apiKey: TOKEN, clientSecret: TOKEN, name: 'catalog' })
      expect(JSON.stringify(err)).not.toContain(TOKEN)
      expect(err.response.data).toEqual({ reason: 'bad input' })
    })

    it('from credential-named params and URL query values, keeping the others', async () => {
      const err = await failure(`/fail?an=acme&appToken=${TOKEN}`, { params: { apiKey: TOKEN, page: 2 } })

      expect(err.config.params).toEqual({ apiKey: REDACTED, page: 2 })
      expect(err.config.url).toBe(`/fail?an=acme&appToken=${REDACTED}`)
      expect(JSON.stringify(err)).not.toContain(TOKEN)
    })

    it('from nested params and arrays of objects, which the client serializes too', async () => {
      const err = await failure('/fail', { params: { filter: { appToken: TOKEN, status: 'open' }, list: [{ apiKey: TOKEN }], page: 2 } })

      expect(err.config.params).toEqual({ filter: { appToken: REDACTED, status: 'open' }, list: [{ apiKey: REDACTED }], page: 2 })
      expect(JSON.stringify(err)).not.toContain(TOKEN)
      expect(JSON.stringify(cleanError(err))).not.toContain(TOKEN)
    })

    it('from nested keys in the URL query', async () => {
      const err = await failure(`/fail?filter[appToken]=${TOKEN}&filter[status]=open`)

      expect(err.config.url).toBe(`/fail?filter[appToken]=${REDACTED}&filter[status]=open`)
    })

    it('from params nested deeper than it inspects, which are truncated, not kept', () => {
      let params: any = { appToken: TOKEN }
      for (let i = 0; i < 40; i++) { params = { child: params } }
      const err: any = new Error('failed')
      err.config = { params }

      expect(JSON.stringify(sanitizeHttpClientError(err).config)).not.toContain(TOKEN)
      expect(JSON.stringify(sanitizeHttpClientError(err).config)).toContain('[Truncated]')
    })

    it('from credential-named fields of a form body, keeping the others', async () => {
      const err = await failure('/fail', {
        data: `appToken=${encodeURIComponent(TOKEN)}&client_secret=s3cr3t-value&name=catalog`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'post',
      })

      expect(err.config.data).toBe(`appToken=${REDACTED}&client_secret=${REDACTED}&name=catalog`)
      expect(JSON.stringify(err)).not.toContain(encodeURIComponent(TOKEN))
      expect(JSON.stringify(cleanError(err))).not.toContain('s3cr3t-value')
    })

    it('from user info in the URL', async () => {
      const err = await failure(`${baseURL.replace('://', '://appkey:s3cr3t-password@')}/fail`)

      expect(err.config.url).toBe(`${baseURL.replace('://', `://${REDACTED}@`)}/fail`)
      expect(JSON.stringify(err)).not.toContain('s3cr3t-password')
    })

    it('from a failed stream response, whose data holds the raw request', async () => {
      const err = await failure('/fail', { responseType: 'stream' })

      expect(typeof err.response.data.pipe).toBe('function')
      expect(Object.keys(err.response)).not.toContain('data')
      expect(JSON.stringify(err)).not.toContain(TOKEN)
      expect(inspect(err, { depth: 6 })).not.toContain(TOKEN)
      err.response.data.destroy()
    })

    it('from the tracing of a sampled request, which records the full URL', () => {
      const err: any = new Error('failed')
      err.config = { tracing: { tags: { 'http.url': `/fail?appToken=${TOKEN}` } }, url: `/fail?appToken=${TOKEN}` }

      const result = sanitizeHttpClientError(err)

      expect(result.config.tracing.tags['http.url']).toContain(TOKEN)
      expect(Object.keys(result.config)).not.toContain('tracing')
      expect(JSON.stringify(result)).not.toContain(TOKEN)
    })

    it('from basic auth', async () => {
      const err = await failure('/fail', { auth: { password: TOKEN, username: 'appkey-0123456789abcdef' } })

      expect(err.config.auth).toEqual({ password: REDACTED, username: REDACTED })
    })
  })

  describe('does not change the requests', () => {
    it('sends the real credentials on every retry, and the call succeeds', async () => {
      flaky = 2

      const ctx = await call('/flaky', {}, 2)

      expect(ctx.response!.status).toBe(200)
      expect(received).toHaveLength(3)
      received.forEach(req => expect(req.headers['proxy-authorization']).toBe(TOKEN))
    })

    it('sends the real credentials on the next call after a failure', async () => {
      await failure()
      received = []

      await call('/ok')

      expect(received[0].headers['proxy-authorization']).toBe(TOKEN)
      expect(received[0].headers.vtexidclientautcookie_acme).toBe(STORE_TOKEN)
    })

    it('does not change the config the caller passed', async () => {
      const headers = { 'x-vtex-api-appkey': 'appkey-0123456789abcdef' }
      const params = { appToken: TOKEN }

      await failure('/fail', { headers, params })

      expect(headers['x-vtex-api-appkey']).toBe('appkey-0123456789abcdef')
      expect(params.appToken).toBe(TOKEN)
    })
  })

  describe('with values that are not HTTP errors', () => {
    it('logs, without throwing, when even clearing the credentials fails', () => {
      const hostile: any = new Error('failed')
      // Reading `response` throws, both while masking and while clearing.
      Object.defineProperty(hostile, 'response', { enumerable: true, get: () => { throw new TypeError('hostile') } })
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      expect(() => sanitizeHttpClientError(hostile)).not.toThrow()
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('could not be cleared'), 'TypeError')
      consoleError.mockRestore()
    })

    it('returns them as they are, and never throws', () => {
      const frozen = Object.freeze({ config: Object.freeze({ headers: { authorization: TOKEN } }) })

      expect(sanitizeHttpClientError(undefined)).toBeUndefined()
      expect(sanitizeHttpClientError('text')).toBe('text')
      expect(() => sanitizeHttpClientError(frozen)).not.toThrow()
    })

    it('removes the credential fields when masking throws', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      const err: any = new Error('failed')
      err.config = {
        headers: { authorization: TOKEN, toJSON: () => { throw new Error('boom') } },
        url: `/orders?appToken=${TOKEN}`,
      }
      err.request = { _header: `authorization: ${TOKEN}` }
      err.response = {
        config: err.config,
        data: { reason: 'no' },
        headers: { 'set-cookie': `vtex_session=${TOKEN}`, 'www-authenticate': 'Bearer' },
        request: err.request,
        status: 401,
      }

      const result = sanitizeHttpClientError(err)

      expect(result).toBe(err)
      expect(result.message).toBe('failed')
      expect(result.response.status).toBe(401)
      expect(result.response.data).toEqual({ reason: 'no' })
      expect(result.config).toEqual({})
      expect(result.request).toBeUndefined()
      expect(result.response.config).toEqual({})
      expect(result.response.headers).toEqual({})
      expect(result.response.request).toBeUndefined()
      expect(JSON.stringify(result)).not.toContain(TOKEN)
      expect(consoleError).toHaveBeenCalled()
    })

    it('masks an error that is not from axios but carries a config', () => {
      const err: any = new Error('failed')
      err.config = { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'json' } }

      const result = sanitizeHttpClientError(err)

      expect(result).toBe(err)
      expect(result.config.headers).toEqual({ Authorization: REDACTED, accept: 'json' })
    })
  })
})
